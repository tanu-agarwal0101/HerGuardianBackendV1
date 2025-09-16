// services/sosService.js
import prisma from "../utils/prisma.js";
import { sendSOSMail } from "../utils/emailService.js";
import { statusCode } from "../utils/statusCode.js";
import { checkUserId } from "../utils/validators.js";

export async function triggerSOS(userId, { lat, lon }, triggeredAt) {
//   if (!(await checkUserId(userId))) {
//     throw { status: statusCode.Unauthorized401, message: "invalid user id" };
//   }

  if (!lat || !lon) {
    throw { status: statusCode.BadRequest400, message: "Location is required" };
  }

  const time = triggeredAt ? new Date(triggeredAt) : new Date();

  const sos = await prisma.sOSAlert.create({
    data: {
      userId,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      triggeredAt: time,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { emergencyContacts: true },
  });

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

    await sendSOSMail({
      to: emails,
      userName: user.firstName || "A user",
      locationUrl,
      triggeredTime,
    });
  }

  // mark resolved if needed
  await prisma.sOSAlert.update({
    where: { id: sos.id },
    data: { resolved: true },
  });
console.log("sos sent")
  return sos;
}
