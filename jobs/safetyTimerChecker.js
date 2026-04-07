import Cron from "node-cron";
import prisma from "../utils/prisma.js";
import logger from "../utils/logger.js";
import { triggerSOS } from "../utils/triggerSos.js";

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
            
            await triggerSOS(
              user.id, 
              { 
                lat: timer.latitude, 
                lon: timer.longitude, 
                timerId: timer.id 
              }, 
              timer.expiresAt
            );

            logger.info({ timerId: timer.id, userId: user.id }, "Safety timer escalated to unified SOS alert");
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
