import logger from "./logger.js";
import prisma from "./prisma.js";

export async function cleanupExpiredBlacklistTokens() {
  try {
    const result = await prisma.blackListToken.deleteMany({
      where: {
        expiresAt: {
          not: null,
          lt: new Date(),
        },
      },
    });
    if (result.count > 0) {
      logger.info({ count: result.count }, "[cleanup] Removed expired blacklist tokens");
    }
  } catch (err) {
    logger.error({ err }, "[cleanup] Failed to clean up blacklist tokens");
  }
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startBlacklistCleanupJob() {

  cleanupExpiredBlacklistTokens();

  setInterval(cleanupExpiredBlacklistTokens, CLEANUP_INTERVAL_MS);
}
