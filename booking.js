const SERVICE_PRICE = 16000;
const WORK_START = 7;
const WORK_END = 21;

const calendarGrid = document.getElementById("calendarGrid");
const monthTitle = document.getElementById("monthTitle");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const modal = document.getElementById("dayModal");
const modalDate = document.getElementById("modalDate");
const modalSubtitle = document.getElementById("modalSubtitle");
const daySlots = document.getElementById("daySlots");
const closeModal = document.getElementById("closeModal");
const confirmBooking = document.getElementById("confirmBooking");
const selectedDateSummary = document.getElementById("selectedDateSummary");
const selectedTimeSummary = document.getElementById("selectedTimeSummary");
const clientNameDisplay = document.getElementById("clientNameDisplay");
const clientPhoneDisplay = document.getElementById("clientPhoneDisplay");
const pendingBanner = document.getElementById("pendingBanner");
const toast = document.getElementById("toast");

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

let visibleMonth = new Date();
visibleMonth.setDate(1);

let selectedDateKey = "";
let selectedTime = "";

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "{}");
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeLocalDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function prettyDate(dateKey) {
  return makeLocalDate(dateKey).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function timeLabel(time) {
  const [hour] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "p.m." : "a.m.";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${suffix}`;
}

function timesRange() {
  const times = [];
  for (let hour = WORK_START; hour < WORK_END; hour += 1) {
    times.push(`${String(hour).padStart(2, "0")}:00`);
  }
  return times;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

function updateSummary() {
  selectedDateSummary.textContent = selectedDateKey ? prettyDate(selectedDateKey) : "Sin seleccionar";
  selectedTimeSummary.textContent = selectedTime ? timeLabel(selectedTime) : "Sin seleccionar";
  confirmBooking.disabled = !(selectedDateKey && selectedTime);
}

function hydrateUser(user) {
  if (clientNameDisplay) clientNameDisplay.textContent = user.name || "-";
  if (clientPhoneDisplay) clientPhoneDisplay.textContent = user.phone || "-";
  if (pendingBanner) {
    pendingBanner.classList.toggle("hidden", user.status !== "pending");
  }
}

async function requireClient() {
  const currentUser = getCurrentUser();

  if (currentUser.role !== "client" || !currentUser.phone) {
    localStorage.removeItem("currentUser");
    window.location.href = "loguin.html";
    return null;
  }

  const { data, error } = await db
    .from("client_users")
    .select("*")
    .eq("phone", currentUser.phone)
    .maybeSingle();

  if (error || !data || data.status === "rejected") {
    localStorage.removeItem("currentUser");
    window.location.href = "loguin.html";
    return null;
  }

  const sessionUser = {
    id: data.id,
    name: data.name,
    phone: data.phone,
    role: "client",
    status: data.status
  };

  localStorage.setItem("currentUser", JSON.stringify(sessionUser));
  return data;
}

async function loadAppointmentsBetween(startKey, endKey) {
  const { data, error } = await db
    .from("appointments")
    .select("date, time")
    .gte("date", startKey)
    .lte("date", endKey);

  if (error) throw error;
  return data;
}

async function loadBusyTimes(dateKey) {
  const { data, error } = await db
    .from("appointments")
    .select("time")
    .eq("date", dateKey);

  if (error) throw error;
  return data.map((appointment) => appointment.time);
}

function isPastDate(dateKey) {
  const todayKey = toDateKey(new Date());
  return dateKey < todayKey;
}

async function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 41);

  monthTitle.textContent = `${monthNames[month]} ${year}`;
  calendarGrid.innerHTML = `<div class="empty">Cargando calendario...</div>`;

  let appointments = [];
  try {
    appointments = await loadAppointmentsBetween(toDateKey(start), toDateKey(end));
  } catch (error) {
    calendarGrid.innerHTML = `<div class="empty">No se pudo cargar el calendario.</div>`;
    console.error(error);
    return;
  }

  calendarGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = toDateKey(date);
    const dayAppointments = appointments.filter((appointment) => appointment.date === dateKey);
    const isCurrentMonth = date.getMonth() === month;
    const isToday = dateKey === toDateKey(new Date());
    const isPast = isPastDate(dateKey);
    const freeSlots = timesRange().length - dayAppointments.length;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `day${isCurrentMonth ? "" : " outside"}${isToday ? " today" : ""}${isPast ? " past" : ""}`;
    button.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      <span class="day-meta">
        <span>${isPast ? "Pasado" : freeSlots === timesRange().length ? "Libre" : `${freeSlots} libres`}</span>
        ${dayAppointments.length && !isPast ? '<span class="dot"></span>' : ""}
      </span>
    `;

    if (!isPast) {
      button.addEventListener("click", () => openDay(dateKey));
    } else {
      button.disabled = true;
    }

    calendarGrid.appendChild(button);
  }
}

async function openDay(dateKey) {
  let busyTimes = [];

  daySlots.innerHTML = `<div class="empty">Cargando horarios...</div>`;
  modalDate.textContent = prettyDate(dateKey);
  modalSubtitle.textContent = "Selecciona una hora libre para tu cita.";
  modal.classList.remove("hidden");

  try {
    busyTimes = await loadBusyTimes(dateKey);
  } catch (error) {
    daySlots.innerHTML = `<div class="empty">No se pudieron cargar los horarios.</div>`;
    console.error(error);
    return;
  }

  const availableTimes = timesRange().filter((time) => !busyTimes.includes(time));

  if (availableTimes.length === 0) {
    daySlots.innerHTML = `<div class="empty">No hay horarios disponibles este dia. Elige otra fecha.</div>`;
    return;
  }

  daySlots.innerHTML = "";

  timesRange().forEach((time) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `slot${selectedDateKey === dateKey && selectedTime === time ? " selected" : ""}`;
    button.textContent = timeLabel(time);
    button.dataset.time = time;

    if (busyTimes.includes(time)) {
      button.disabled = true;
      button.classList.add("busy");
      button.title = "Horario ocupado";
      daySlots.appendChild(button);
      return;
    }

    button.addEventListener("click", () => {
      selectedDateKey = dateKey;
      selectedTime = time;
      updateSummary();
      modal.classList.add("hidden");
      showToast(`Horario seleccionado: ${prettyDate(dateKey)} - ${timeLabel(time)}`);
    });

    daySlots.appendChild(button);
  });
}

async function submitBooking() {
  const user = getCurrentUser();

  if (!selectedDateKey || !selectedTime) {
    showToast("Selecciona un dia y una hora disponible.");
    return;
  }

  const { error } = await db.from("appointments").insert({
    user_id: user.id,
    name: user.name,
    phone: user.phone,
    date: selectedDateKey,
    time: selectedTime,
    service: "Corte",
    price: SERVICE_PRICE
  });

  if (error) {
    if (error.code === "23505") {
      showToast("Ese horario acaba de ocuparse. Elige otro.");
      selectedTime = "";
      updateSummary();
      await openDay(selectedDateKey);
      await renderCalendar();
      return;
    }

    showToast("No se pudo confirmar la cita. Revisa la conexion.");
    console.error(error);
    return;
  }

  selectedTime = "";
  updateSummary();
  await renderCalendar();
  showToast("Cita confirmada. Te esperamos en JMbarber.");
}

async function initBooking() {
  const clientUser = await requireClient();
  if (!clientUser) return;

  hydrateUser(clientUser);
  updateSummary();
  await renderCalendar();

  prevMonth.addEventListener("click", async () => {
    visibleMonth.setMonth(visibleMonth.getMonth() - 1);
    await renderCalendar();
  });

  nextMonth.addEventListener("click", async () => {
    visibleMonth.setMonth(visibleMonth.getMonth() + 1);
    await renderCalendar();
  });

  closeModal.addEventListener("click", () => modal.classList.add("hidden"));

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modal.classList.add("hidden");
  });

  confirmBooking.addEventListener("click", submitBooking);
}

if (calendarGrid) {
  initBooking();
}
