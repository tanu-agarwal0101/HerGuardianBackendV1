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

let isJobRunning = false;

Cron.schedule("* * * * *", async () => {
  if (isJobRunning) {
    console.warn("Previous cron job still running; skipping new cycle.");
    return;
  }
  isJobRunning = true;

  const now = new Date();
  try {
    const healthy = await isDbHealthy();
    if (!healthy) {
       isJobRunning = false;
       return; 
    }
    
    // Find expired timers
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

    if (expiredTimers.length > 0) {
        console.log(`Processing ${expiredTimers.length} expired timers...`);
    }

    // Process timers concurrently (limit concurrency if needed, but safe here)
    await Promise.all(expiredTimers.map(async (timer) => {
        try {
            // Step 1: Mark timer as escalated (atomic update)
            await prisma.safetyTimer.update({
                where: { id: timer.id },
                data: {
                isActive: false,
                status: "escalated",
                },
            });

            // Log location snapshot when timer expires (fire and forget)
            if (timer.latitude && timer.longitude) {
                prisma.locationLog.create({
                data: {
                    userId: timer.userId,
                    timerId: timer.id,
                    latitude: timer.latitude,
                    longitude: timer.longitude,
                    event: "expired",
                },
                }).catch(() => {}); // silent fail safe
            }

            const user = timer.user;
            const contacts = user.emergencyContacts;

            // Step 2: Trigger SOS Alert
            await prisma.sOSAlert.create({
                data: {
                userId: user.id,
                timerId: timer.id,
                latitude: timer.latitude || 0,
                longitude: timer.longitude || 0,
                triggeredAt: new Date(),
                resolved: false,
                },
            });

            // Step 3: Notify Contacts concurrently
            await Promise.all(contacts.map(async (contact) => {
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
            }));

            console.log(
                `All SOS emails sent for user ${user.email || user.id} (timer ${timer.id})`
            );
        } catch (timerError) {
            console.error(`Error processing timer ${timer.id}:`, timerError);
        }
    }));

  } catch (e) {
    console.error("Cron Job error", e);
  } finally {
    isJobRunning = false;
  }
});
