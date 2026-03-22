import Cron from "node-cron";
import prisma from "../utils/prisma.js";
import logger from "../utils/logger.js";

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; 
Cron.schedule("*/15 * * * *", async () => {
  const now = new Date();
  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_LIMIT_MS);

  try {
    const hardExpired = await prisma.sOSTrackingSession.updateMany({
      where: {
        status: "active",
        expiresAt: { lt: now },
      },
      data: { status: "expired" },
    });

    const inactiveExpired = await prisma.sOSTrackingSession.updateMany({
      where: {
        status: "active",
        lastUpdateAt: { lt: inactivityCutoff },
        createdAt: { lt: inactivityCutoff },
      },
      data: { status: "expired" },
    });

    const total = hardExpired.count + inactiveExpired.count;
    if (total > 0) {
      logger.info(
        { hardExpired: hardExpired.count, inactiveExpired: inactiveExpired.count },
        "Expired stale SOS tracking sessions"
      );
    }
  } catch (err) {
    logger.error({ err }, "Failed to run SOS session expiry cron");
  }
});
