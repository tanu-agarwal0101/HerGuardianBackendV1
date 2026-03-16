import logger from "./logger.js";
import prisma from "../utils/prisma.js";
import { sendSOSMail } from "../utils/emailService.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";
import { notifyUser } from "../utils/pushToUser.js";

export async function triggerSOS(userId, { lat, lon, timerId }, triggeredAt) {
  if (lat === undefined || lon === undefined || lat === null || lon === null) {
    throw { statusCode: statusCode.BadRequest400, message: "Location is required" };
  }

  const time = triggeredAt ? new Date(triggeredAt) : new Date();

  const sos = await prisma.sOSAlert.create({
    data: {
      userId,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      triggeredAt: time,
      ...(timerId ? { timerId } : {}),
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { emergencyContacts: true },
  });

  const notificationResults = {
    email: { success: false, message: "No emergency contacts found" },
    push: { success: false, message: "Not attempted" },
  };

  if (user?.emergencyContacts?.length) {
    const triggeredTime = time.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const emails = user.emergencyContacts.map((c) => c.email).filter(Boolean);
    const locationUrl = `https://www.google.com/maps?q=${lat},${lon}`;

    if (emails.length > 0) {
      try {
        await sendSOSMail({
          to: emails,
          userName: user.firstName || "A user",
          locationUrl,
          triggeredAt: triggeredTime,
        });
        notificationResults.email = { success: true, message: "Emails sent successfully" };
      } catch (err) {
        logger.error({ err, userId }, "Failed to send SOS Email");
        notificationResults.email = { success: false, message: err.message || "Failed to send email" };
      }
    }
  }

  // Push notification to user's devices
  try {
    await notifyUser(userId, {
      title: "🚨 SOS Alert Triggered",
      body: "Your emergency contacts have been notified.",
      url: `https://www.google.com/maps?q=${lat},${lon}`,
    });
    notificationResults.push = { success: true, message: "Push notifications sent" };
  } catch (err) {
    logger.error({ err, userId }, "Failed to send push notification");
    notificationResults.push = { success: false, message: err.message || "Failed to send push notification" };
  }

  // mark resolved if needed
  await prisma.sOSAlert.update({
    where: { id: sos.id },
    data: { resolved: true },
  });

  return { sos, notificationResults };
}
