import Cron from "node-cron";
import prisma from "../utils/prisma.js";
import { sendSOSMail } from "../utils/emailService.js";

let lastDbErrorLogAt = 0;
const DB_ERROR_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function isDbHealthy() {
  try {
    // MongoDB connector supports $runCommandRaw for ping
    await prisma.$runCommandRaw({ ping: 1 });
    return true;
  } catch (e) {
    const now = Date.now();
    if (now - lastDbErrorLogAt > DB_ERROR_LOG_INTERVAL_MS) {
      console.error("Cron DB health check failed; skipping this cycle", e);
      lastDbErrorLogAt = now;
    }
    return false;
  }
}

Cron.schedule("* * * * *", async () => {
  const now = new Date();
  try {
    const healthy = await isDbHealthy();
    if (!healthy) return; // skip this cycle quietly
    const expiredTimers = await prisma.safetyTimer.findMany({
      where: {
        isActive: true,
        expiresAt: { lte: now },
      },
      include: {
        user: {
          include: {
            emergencyContacts: true,
          },
        },
      },
    });

    for (const timer of expiredTimers) {
      // Step 1: Mark timer as escalated
      await prisma.safetyTimer.update({
        where: { id: timer.id },
        data: {
          isActive: false,
          status: "escalated",
        },
      });

      const user = timer.user;
      const contacts = user.emergencyContacts;

      // Step 2: Trigger SOS Alert
      const sos = await prisma.sOSAlert.create({
        data: {
          userId: user.id,
          latitude: timer.latitude || 0,
          longitude: timer.longitude || 0,
          triggeredAt: new Date(),
          resolved: false,
        },
      });

      // Step 3: Notify Contacts (send real emails)
      for (const contact of contacts) {
        if (contact.email) {
          try {
            console.log(`Sending SOS email to ${contact.email}...`);
            await sendSOSMail({
              to: contact.email,
              userName: user.firstName || user.email || "User",
              locationUrl: `https://maps.google.com/?q=${timer.latitude || 0},${timer.longitude || 0}`,
              triggeredAt: timer.expiresAt.toLocaleString(),
            });
            console.log(`SOS email sent to ${contact.email}`);
          } catch (e) {
            console.error(`Failed to send SOS email to ${contact.email}:`, e);
          }
        }
      }
      console.log(
        `All SOS emails sent for user ${user.email || user.id} (timer ${timer.id})`
      );
    }
  } catch (e) {
    console.error("Cron Job error", e);
  }
});
