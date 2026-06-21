const calendarGrid = document.getElementById("calendarGrid");
const monthTitle = document.getElementById("monthTitle");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const modal = document.getElementById("dayModal");
const modalDate = document.getElementById("modalDate");
const modalSubtitle = document.getElementById("modalSubtitle");
const daySlots = document.getElementById("daySlots");
const vipDayInfo = document.getElementById("vipDayInfo");
const closeModal = document.getElementById("closeModal");
const confirmBooking = document.getElementById("confirmBooking");
const selectedDateSummary = document.getElementById("selectedDateSummary");
const selectedTimeSummary = document.getElementById("selectedTimeSummary");
const clientNameDisplay = document.getElementById("clientNameDisplay");
const clientPhoneDisplay = document.getElementById("clientPhoneDisplay");
const pendingBanner = document.getElementById("pendingBanner");
const vipBanner = document.getElementById("vipBanner");
const vipBannerText = document.getElementById("vipBannerText");
const bookingQuotaPill = document.getElementById("bookingQuotaPill");
const quotaWarning = document.getElementById("quotaWarning");
const upcomingBanner = document.getElementById("upcomingBanner");
const upcomingList = document.getElementById("upcomingList");
const pastBanner = document.getElementById("pastBanner");
const pastList = document.getElementById("pastList");
const rescheduleModal = document.getElementById("rescheduleModal");
const rescheduleTitle = document.getElementById("rescheduleTitle");
const rescheduleSubtitle = document.getElementById("rescheduleSubtitle");
const rescheduleForm = document.getElementById("rescheduleForm");
const rescheduleDate = document.getElementById("rescheduleDate");
const rescheduleTime = document.getElementById("rescheduleTime");
const closeRescheduleModal = document.getElementById("closeRescheduleModal");
const skipVipBtn = document.getElementById("skipVipBtn");
const toast = document.getElementById("toast");

let visibleMonth = new Date();
visibleMonth.setDate(1);

let selectedDateKey = "";
let selectedTime = "";
let currentClient = null;
let cachedVipSchedules = [];
let cachedVipExceptions = [];
let activeReschedule = null;
let bookingsInWindow = 0;

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "{}");
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
  const quotaReached = bookingsInWindow >= STUDIO.MAX_BOOKINGS_PER_WINDOW;
  confirmBooking.disabled = quotaReached || !(selectedDateKey && selectedTime);
  quotaWarning?.classList.toggle("hidden", !quotaReached);
  if (quotaReached) {
    confirmBooking.classList.add("quota-blocked");
  } else {
    confirmBooking.classList.remove("quota-blocked");
  }
}

function hydrateUser(user) {
  if (clientNameDisplay) clientNameDisplay.textContent = user.name || "-";
  if (clientPhoneDisplay) clientPhoneDisplay.textContent = user.phone || "-";
  if (pendingBanner) pendingBanner.classList.toggle("hidden", user.status !== "pending");
}

function updateQuotaPill() {
  bookingQuotaPill.textContent = `${bookingsInWindow}/${STUDIO.MAX_BOOKINGS_PER_WINDOW} citas`;
}

function getMyVipSchedules() {
  return cachedVipSchedules.filter((vip) => vip.user_id === currentClient?.id);
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

async function refreshBookingData() {
  const vipData = await loadVipData();
  cachedVipSchedules = vipData.vipSchedules;
  cachedVipExceptions = vipData.vipExceptions;
  bookingsInWindow = await countUserBookingsInWindow(
    currentClient.id,
    getClientWindowStart(),
    getClientWindowEnd()
  );
  updateQuotaPill();
  updateSummary();
}

function isBookableDate(dateKey) {
  return isInClientWindow(dateKey);
}

function renderVipBanner() {
  const myVips = getMyVipSchedules();
  if (!vipBanner || myVips.length === 0) {
    vipBanner?.classList.add("hidden");
    return;
  }

  const lines = myVips.map(
    (vip) => `${WEEKDAY_NAMES[vip.day_of_week]} ${timeLabel(vip.time)} (${frequencyLabel(vip.frequency)})`
  );
  vipBannerText.textContent = `Tienes horario VIP fijo: ${lines.join(" | ")}. Puedes reagendar un dia puntual desde el calendario.`;
  vipBanner.classList.remove("hidden");
}

function getAppointmentTimestamp(dateKey, time) {
  const date = makeLocalDate(dateKey);
  const [hour, minute = 0] = time.split(":").map(Number);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

async function loadUserAppointments(userId) {
  const { data, error } = await db
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

async function renderAppointmentBanners() {
  if (!upcomingBanner || !upcomingList || !pastBanner || !pastList || !currentClient) return;

  const appointments = await loadUserAppointments(currentClient.id);
  const now = Date.now();

  const upcomingItems = appointments
    .filter((item) => getAppointmentTimestamp(item.date, item.time) > now)
    .map((item) => ({ dateKey: item.date, time: item.time, kind: "Cita" }));

  const pastItems = appointments
    .filter((item) => getAppointmentTimestamp(item.date, item.time) <= now)
    .map((item) => ({ dateKey: item.date, time: item.time, kind: "Cita" }));

  const vipItems = [];
  for (let offset = 0; offset < STUDIO.CLIENT_WINDOW_DAYS; offset += 1) {
    const dateKey = addDays(getClientWindowStart(), offset);
    const occurrences = getVipOccurrencesForDate(getMyVipSchedules(), cachedVipExceptions, dateKey)
      .filter((item) => !item.isRescheduledAway);
    occurrences.forEach((item) => {
      const isFuture = getAppointmentTimestamp(dateKey, item.time) > now;
      if (isFuture) {
        vipItems.push({ dateKey, time: item.time, kind: "VIP" });
      } else {
        pastItems.push({ dateKey, time: item.time, kind: "VIP" });
      }
    });
  }

  const upcomingListItems = [...upcomingItems, ...vipItems].sort((left, right) => {
    if (left.dateKey === right.dateKey) return left.time.localeCompare(right.time);
    return left.dateKey.localeCompare(right.dateKey);
  });

  if (upcomingListItems.length === 0) {
    upcomingBanner.classList.add("hidden");
    upcomingList.innerHTML = "";
  } else {
    upcomingList.innerHTML = upcomingListItems
      .map((item) => `<li><strong>${prettyDateShort(item.dateKey)}</strong> - ${timeLabel(item.time)} <span class="pill">${item.kind}</span></li>`)
      .join("");
    upcomingBanner.classList.remove("hidden");
  }

  const pastListItems = pastItems
    .sort((left, right) => {
      if (left.dateKey === right.dateKey) return left.time.localeCompare(right.time);
      return left.dateKey.localeCompare(right.dateKey);
    });

  if (pastListItems.length === 0) {
    pastBanner.classList.add("hidden");
    pastList.innerHTML = "";
  } else {
    pastList.innerHTML = pastListItems
      .map((item) => `<li><strong>${prettyDateShort(item.dateKey)}</strong> - ${timeLabel(item.time)} <span class="pill">${item.kind}</span></li>`)
      .join("");
    pastBanner.classList.remove("hidden");
  }
}

async function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 41);

  monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;
  calendarGrid.innerHTML = `<div class="empty">Cargando calendario...</div>`;

  let slotsByDate = {};
  try {
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = toDateKey(date);
      if (isBookableDate(dateKey)) {
        slotsByDate[dateKey] = await buildDaySlots(dateKey, cachedVipSchedules, cachedVipExceptions);
      }
    }
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
    const isCurrentMonth = date.getMonth() === month;
    const isToday = dateKey === toDateKey(new Date());
    const bookable = isBookableDate(dateKey);
    const daySlotsData = slotsByDate[dateKey] || [];
    const summary = summarizeDaySlots(daySlotsData);
    const myVipToday = getVipOccurrencesForDate(getMyVipSchedules(), cachedVipExceptions, dateKey)
      .filter((item) => !item.isRescheduledAway);

    let statusLabel = "Fuera de rango";
    let dayClass = "";

    if (bookable) {
      if (summary.closed) {
        statusLabel = "Cerrado";
        dayClass = "day-closed";
      } else if (myVipToday.length) {
        statusLabel = "VIP";
        dayClass = "vip-day";
      } else if (summary.full) {
        statusLabel = "Lleno";
        dayClass = "day-full";
      } else if (summary.freeCount < summary.totalCount) {
        statusLabel = `${summary.freeCount} libres`;
        dayClass = "day-partial";
      } else {
        statusLabel = `${summary.freeCount} libres`;
        dayClass = "day-available";
      }
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `day${isCurrentMonth ? "" : " outside"}${isToday ? " today" : ""}${bookable ? "" : " past"} ${dayClass}`.trim();
    button.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      <span class="day-meta">
        <span>${statusLabel}</span>
        ${bookable && (summary.closed || summary.full || summary.freeCount < summary.totalCount || myVipToday.length) ? '<span class="dot"></span>' : ""}
      </span>
    `;

    if (bookable) {
      button.addEventListener("click", () => openDay(dateKey));
    } else {
      button.disabled = true;
    }

    calendarGrid.appendChild(button);
  }
}

async function openDay(dateKey) {
  let slots = [];
  const myVipToday = getVipOccurrencesForDate(getMyVipSchedules(), cachedVipExceptions, dateKey)
    .filter((item) => !item.isRescheduledAway);
  const closed = await isDayClosed(dateKey);

  daySlots.innerHTML = `<div class="empty">Cargando horarios...</div>`;
  modalDate.textContent = prettyDate(dateKey);
  modal.classList.remove("hidden");

  if (vipDayInfo) {
    if (myVipToday.length) {
      vipDayInfo.classList.remove("hidden");
      vipDayInfo.innerHTML = `
        <strong>Tu cita VIP: ${timeLabel(myVipToday[0].time)}</strong>
        <button class="btn secondary" type="button" id="openRescheduleBtn">Cambiar solo este dia</button>
      `;
      vipDayInfo.querySelector("#openRescheduleBtn").addEventListener("click", () => {
        openRescheduleEditor(myVipToday[0], dateKey);
      });
    } else {
      vipDayInfo.classList.add("hidden");
      vipDayInfo.innerHTML = "";
    }
  }

  try {
    slots = await buildDaySlots(dateKey, cachedVipSchedules, cachedVipExceptions);
  } catch (error) {
    daySlots.innerHTML = `<div class="empty">No se pudieron cargar los horarios.</div>`;
    console.error(error);
    return;
  }

  const summary = summarizeDaySlots(slots);
  if (closed) {
    modalSubtitle.textContent = "El barbero no trabaja este dia.";
    daySlots.innerHTML = `<div class="empty">Este dia esta cerrado. Elige otra fecha.</div>`;
    return;
  }

  modalSubtitle.textContent = summary.full
    ? "Este dia esta completo. Todas las horas estan ocupadas."
    : "Selecciona una hora libre para tu cita.";

  daySlots.innerHTML = "";

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `slot${selectedDateKey === dateKey && selectedTime === slot.time ? " selected" : ""}`;
    button.textContent = timeLabel(slot.time);

    if (slot.status === "free") {
      button.addEventListener("click", () => {
        if (bookingsInWindow >= STUDIO.MAX_BOOKINGS_PER_WINDOW) {
          showToast(`Has alcanzado el maximo de ${STUDIO.MAX_BOOKINGS_PER_WINDOW} citas en los proximos 7 dias.`);
          return;
        }
        selectedDateKey = dateKey;
        selectedTime = slot.time;
        updateSummary();
        modal.classList.add("hidden");
        showToast(`Horario seleccionado: ${prettyDate(dateKey)} - ${timeLabel(slot.time)}`);
      });
      daySlots.appendChild(button);
      return;
    }

    button.disabled = true;
    button.classList.add("busy");
    if (slot.status === "vip" && slot.vip.vip.user_id === currentClient.id) {
      button.title = "Tu horario VIP";
      button.classList.add("vip-slot");
    } else if (slot.status === "booked") {
      button.title = "Horario ocupado";
    } else if (slot.status === "blocked") {
      button.title = "Horario no disponible";
    } else {
      button.title = "Horario ocupado";
    }
    daySlots.appendChild(button);
  });
}

function populateRescheduleTimeOptions(dateKey) {
  rescheduleTime.innerHTML = defaultTimesRange()
    .map((time) => `<option value="${time}">${timeLabel(time)}</option>`)
    .join("");
}

function openRescheduleEditor(occurrence, originalDateKey) {
  activeReschedule = { occurrence, originalDateKey };
  rescheduleTitle.textContent = "Cambiar cita VIP";
  rescheduleSubtitle.textContent = `Cita fija del ${prettyDateShort(originalDateKey)} a las ${timeLabel(occurrence.time)}.`;
  rescheduleDate.min = getClientWindowStart();
  rescheduleDate.max = getClientWindowEnd();
  rescheduleDate.value = originalDateKey;
  populateRescheduleTimeOptions(originalDateKey);
  rescheduleTime.value = occurrence.time;
  modal.classList.add("hidden");
  rescheduleModal.classList.remove("hidden");
}

async function saveVipReschedule(newDateKey, newTime) {
  const { occurrence, originalDateKey } = activeReschedule;

  if (!isInClientWindow(newDateKey)) {
    showToast("Solo puedes mover la cita dentro de los proximos 7 dias.");
    return false;
  }

  const slots = await buildDaySlots(newDateKey, cachedVipSchedules, cachedVipExceptions);
  const targetSlot = slots.find((slot) => slot.time === newTime);
  const isSameVipSlot = targetSlot?.status === "vip" && targetSlot.vip.vip.user_id === currentClient.id;

  if (targetSlot?.status !== "free" && !isSameVipSlot) {
    showToast("Esa hora no esta disponible. Elige otra.");
    return false;
  }

  const payload = {
    vip_schedule_id: occurrence.vip.id,
    original_date: originalDateKey,
    action: "reschedule",
    new_date: newDateKey,
    new_time: newTime
  };

  const { error } = await db.from("vip_exceptions").upsert(payload, {
    onConflict: "vip_schedule_id,original_date"
  });

  if (error) {
    showToast("No se pudo reagendar la cita VIP.");
    console.error(error);
    return false;
  }

  await refreshBookingData();
  await renderCalendar();
  await renderAppointmentBanners();
  rescheduleModal.classList.add("hidden");
  showToast("Cita VIP reagendada solo para ese dia.");
  return true;
}

async function skipVipDay() {
  const { occurrence, originalDateKey } = activeReschedule;
  const { error } = await db.from("vip_exceptions").upsert({
    vip_schedule_id: occurrence.vip.id,
    original_date: originalDateKey,
    action: "skip",
    new_date: null,
    new_time: null
  }, { onConflict: "vip_schedule_id,original_date" });

  if (error) {
    showToast("No se pudo registrar la ausencia.");
    console.error(error);
    return;
  }

  await refreshBookingData();
  await renderCalendar();
  await renderAppointmentBanners();
  rescheduleModal.classList.add("hidden");
  showToast("Ese dia VIP quedo liberado.");
}

async function submitBooking() {
  const user = getCurrentUser();

  if (!selectedDateKey || !selectedTime) {
    showToast("Selecciona un dia y una hora disponible.");
    return;
  }

  if (!isInClientWindow(selectedDateKey)) {
    showToast("Solo puedes reservar dentro de los proximos 7 dias.");
    return;
  }

  bookingsInWindow = await countUserBookingsInWindow(
    user.id,
    getClientWindowStart(),
    getClientWindowEnd()
  );
  updateQuotaPill();
  updateSummary();

  if (bookingsInWindow >= STUDIO.MAX_BOOKINGS_PER_WINDOW) {
    showToast(`Has alcanzado el maximo de ${STUDIO.MAX_BOOKINGS_PER_WINDOW} citas en los proximos 7 dias. Cancela una o espera a que pasen.`);
    return;
  }

  const appointment = {
    user_id: user.id,
    name: user.name,
    phone: user.phone,
    date: selectedDateKey,
    time: selectedTime,
    service: "Corte",
    price: STUDIO.PRICE
  };

  const { error } = await db.from("appointments").insert(appointment);

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

  await notifyBookingCreated(appointment);
  selectedTime = "";
  await refreshBookingData();
  await renderCalendar();
  await renderAppointmentBanners();
  updateSummary();
  showToast("Cita confirmada. Te esperamos en JMbarber.");
}

async function initBooking() {
  currentClient = await requireClient();
  if (!currentClient) return;

  hydrateUser(currentClient);
  await refreshBookingData();
  renderVipBanner();
  await renderAppointmentBanners();
  await processDueReminders(currentClient);
  await initPushForCurrentUser(currentClient, "client");
  await renderCalendar();
  updateSummary();

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

  closeRescheduleModal.addEventListener("click", () => rescheduleModal.classList.add("hidden"));
  rescheduleModal.addEventListener("click", (event) => {
    if (event.target === rescheduleModal) rescheduleModal.classList.add("hidden");
  });

  rescheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveVipReschedule(rescheduleDate.value, rescheduleTime.value);
  });

  skipVipBtn.addEventListener("click", skipVipDay);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      modal.classList.add("hidden");
      rescheduleModal.classList.add("hidden");
    }
  });

  confirmBooking.addEventListener("click", () => {
    if (bookingsInWindow >= STUDIO.MAX_BOOKINGS_PER_WINDOW) {
      showToast(`Has alcanzado el maximo de ${STUDIO.MAX_BOOKINGS_PER_WINDOW} citas en los proximos 7 dias.`);
      return;
    }
    submitBooking();
  });
}

if (calendarGrid) {
  initBooking();
}
