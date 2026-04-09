import logger from "./logger.js";
import prisma from "../utils/prisma.js";
import { sendSOSMail } from "../utils/emailService.js";
import { notifyUser } from "../utils/pushToUser.js";
import { createSOSSession } from "../controllers/sosController.js";

export async function triggerSOS(userId, { lat, lon, timerId }, triggeredAt) {
  const time = triggeredAt ? new Date(triggeredAt) : new Date();

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  const isValidCoords = lat != null && lon != null && !isNaN(parsedLat) && !isNaN(parsedLon);

  const finalLat = isValidCoords ? parsedLat : null;
  const finalLon = isValidCoords ? parsedLon : null;

  const sos = await prisma.sOSAlert.create({
    data: {
      userId,
      latitude: finalLat,
      longitude: finalLon,
      triggeredAt: time,
      ...(timerId ? { timerId } : {}),
    },
  });

  let trackingSession = null;
  let trackingUrl = null;
  try {
    const result = await createSOSSession(userId);
    trackingSession = result.session;
    trackingUrl = result.trackingUrl;
  } catch (err) {
    logger.error({ err, userId }, "Failed to create SOS tracking session");
  }

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
    
    let locationDetail = "Location Unknown";
    let locationUrl = null;

    if (isValidCoords) {
      locationUrl = `https://www.google.com/maps?q=${finalLat},${finalLon}`;
      locationDetail = "Live GPS Location";
    } else if (user.location) {
      locationDetail = `Profile Location: ${user.location} (Note: Live coordinates unavailable)`;
    }

    if (emails.length > 0) {
      try {
        await sendSOSMail({
          to: emails,
          userName: user.firstName || "A user",
          locationUrl,
          locationDetail, 
          trackingUrl,  
          triggeredAt: triggeredTime,
        });
        notificationResults.email = { success: true, message: "Emails sent successfully" };
      } catch (err) {
        logger.error({ err, userId }, "Failed to send SOS Email");
        notificationResults.email = { success: false, message: err.message || "Failed to send email" };
      }
    }
  }

  try {
    await notifyUser(userId, {
      title: "🚨 SOS Alert Triggered",
      body: isValidCoords 
        ? "Your emergency contacts have been notified with your live location."
        : "Your emergency contacts have been notified (Live GPS unavailable).",
      url: isValidCoords ? `https://www.google.com/maps?q=${finalLat},${finalLon}` : undefined,
    });
    notificationResults.push = { success: true, message: "Push notifications sent" };
  } catch (err) {
    logger.error({ err, userId }, "Failed to send push notification");
    notificationResults.push = { success: false, message: err.message || "Failed to send push notification" };
  }

  return {
    sos,
    notificationResults,
    trackingSessionId: trackingSession?.id || null,
    trackingUrl: trackingUrl || null,
  };
}
