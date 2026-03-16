import Cron from "node-cron";
import prisma from "../utils/prisma.js";
import { sendSOSMail } from "../utils/emailService.js";
import { notifyUser } from "../utils/pushToUser.js";
import logger from "../utils/logger.js";

let lastDbErrorLogAt = 0;
const DB_ERROR_LOG_INTERVAL_MS = 5 * 60 * 1000;

async function isDbHealthy() {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return true;
  } catch (_e) {
    const now = Date.now();
    if (now - lastDbErrorLogAt > DB_ERROR_LOG_INTERVAL_MS) {
      lastDbErrorLogAt = now;
    }
    return false;
  }
}

let isJobRunning = false;

Cron.schedule("* * * * *", async () => {
  if (isJobRunning) return;
  isJobRunning = true;

  const now = new Date();
  try {
    const healthy = await isDbHealthy();
    if (!healthy) {
       isJobRunning = false;
       return; 
    }
    
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

    await Promise.all(expiredTimers.map(async (timer) => {
        try {
            await prisma.safetyTimer.update({
                where: { id: timer.id },
                data: {
                isActive: false,
                status: "escalated",
                },
            });

            if (timer.latitude && timer.longitude) {
                prisma.locationLog.create({
                data: {
                    userId: timer.userId,
                    timerId: timer.id,
                    latitude: timer.latitude,
                    longitude: timer.longitude,
                    event: "expired",
                },
                }).catch(() => {});
            }

            const user = timer.user;
            const contacts = user.emergencyContacts;

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

            await Promise.all(contacts.map(async (contact) => {
                if (contact.email) {
                    try {
                        await sendSOSMail({
                        to: contact.email,
                        userName: user.firstName || user.email || "User",
                        locationUrl: `https://maps.google.com/?q=${timer.latitude || 0},${timer.longitude || 0}`,
                        triggeredAt: timer.expiresAt.toLocaleString(),
                        });
                    } catch (e) {
                        logger.error({ err: e, contactId: contact.id, userId: user.id }, "Failed to send SOS email to contact");
                    }
                }
            }));

            // Push notification to user's device (fire-and-forget)
            notifyUser(user.id, {
              title: "⏰ Safety Timer Expired",
              body: "Your timer has expired and emergency contacts have been notified.",
              url: `https://maps.google.com/?q=${timer.latitude || 0},${timer.longitude || 0}`,
            }).catch(() => {});
        } catch (timerError) {
            logger.error({ err: timerError, timerId: timer.id, userId: timer.userId }, "Error processing expired safety timer");
        }
    }));

  } catch (e) {
    logger.error({ err: e }, "Critical failure in safety timer checker cron cycle");
  } finally {
    isJobRunning = false;
  }
});
