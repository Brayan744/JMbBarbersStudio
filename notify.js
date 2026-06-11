async function queueNotification({ phone, message, type, relatedDate = null, relatedTime = null }) {
  const { error } = await db.from("notification_log").insert({
    phone,
    message,
    type,
    related_date: relatedDate,
    related_time: relatedTime,
    status: "pending"
  });

  if (error) {
    console.error("No se pudo encolar la notificacion.", error);
    return false;
  }

  try {
    await db.functions.invoke("send-notifications", { body: { phone, message } });
  } catch (invokeError) {
    console.warn("SMS pendiente de configurar en Supabase Edge Function.", invokeError);
  }

  return true;
}

function bookingConfirmationMessage({ name, dateKey, time }) {
  return `JMbarber: Hola ${name}, tu cita quedo confirmada para ${prettyDateShort(dateKey)} a las ${timeLabel(time)}. Servicio: Corte $16.000.`;
}

function barberBookingAlertMessage({ name, phone, dateKey, time }) {
  return `JMbarber: Nueva cita de ${name} (${phone}) el ${prettyDateShort(dateKey)} a las ${timeLabel(time)}.`;
}

function reminderMessage({ name, dateKey, time, isVip = false }) {
  const prefix = isVip ? "Recordatorio VIP" : "Recordatorio";
  return `JMbarber ${prefix}: Hola ${name}, manana tienes cita a las ${timeLabel(time)} (${prettyDateShort(dateKey)}).`;
}

async function notifyBookingCreated(appointment) {
  await Promise.all([
    queueNotification({
      phone: appointment.phone,
      message: bookingConfirmationMessage({
        name: appointment.name,
        dateKey: appointment.date,
        time: appointment.time
      }),
      type: "booking_client",
      relatedDate: appointment.date,
      relatedTime: appointment.time
    }),
    queueNotification({
      phone: STUDIO.BARBER_PHONE,
      message: barberBookingAlertMessage({
        name: appointment.name,
        phone: appointment.phone,
        dateKey: appointment.date,
        time: appointment.time
      }),
      type: "booking_barber",
      relatedDate: appointment.date,
      relatedTime: appointment.time
    })
  ]);
}

async function wasReminderQueuedToday(phone, type, relatedDate) {
  const startOfDay = `${getClientWindowStart()}T00:00:00`;
  const { data, error } = await db
    .from("notification_log")
    .select("id")
    .eq("phone", phone)
    .eq("type", type)
    .eq("related_date", relatedDate)
    .gte("created_at", startOfDay)
    .limit(1);

  if (error) return false;
  return Boolean(data?.length);
}

async function processDueReminders(currentUser) {
  const tomorrowKey = addDays(getClientWindowStart(), 1);
  const { data: appointments, error } = await db
    .from("appointments")
    .select("*")
    .eq("date", tomorrowKey);

  if (error) return;

  const mine = (appointments || []).filter((item) => item.phone === currentUser.phone);
  for (const appointment of mine) {
    const message = reminderMessage({
      name: appointment.name,
      dateKey: appointment.date,
      time: appointment.time,
      isVip: false
    });
    showInAppNotification(message);

    const alreadyQueued = await wasReminderQueuedToday(
      appointment.phone,
      "reminder_client",
      appointment.date
    );

    if (!alreadyQueued) {
      await queueNotification({
        phone: appointment.phone,
        message,
        type: "reminder_client",
        relatedDate: appointment.date,
        relatedTime: appointment.time
      });
    }
  }

  const { vipSchedules, vipExceptions } = await loadVipData();
  const vipTomorrow = getVipOccurrencesForDate(vipSchedules, vipExceptions, tomorrowKey)
    .filter((item) => !item.isRescheduledAway && item.vip.phone === currentUser.phone);

  for (const occurrence of vipTomorrow) {
    const message = reminderMessage({
      name: occurrence.vip.name,
      dateKey: tomorrowKey,
      time: occurrence.time,
      isVip: true
    });
    showInAppNotification(message);

    const alreadyQueued = await wasReminderQueuedToday(
      occurrence.vip.phone,
      "reminder_vip",
      tomorrowKey
    );

    if (!alreadyQueued) {
      await queueNotification({
        phone: occurrence.vip.phone,
        message,
        type: "reminder_vip",
        relatedDate: tomorrowKey,
        relatedTime: occurrence.time
      });
    }
  }
}

function showInAppNotification(message) {
  const banner = document.getElementById("reminderBanner");
  if (!banner) return;
  banner.querySelector("p").textContent = message;
  banner.classList.remove("hidden");
}
