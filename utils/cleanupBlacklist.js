import prisma from "./prisma.js";

/**
 * Deletes expired BlackListToken entries from the database.
 * Should be called periodically (e.g. every hour) to prevent unbounded table growth.
 */
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
      console.log(`[cleanup] Removed ${result.count} expired blacklist tokens`);
    }
  } catch (e) {
    console.error("[cleanup] Failed to clean up blacklist tokens:", e.message);
  }
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startBlacklistCleanupJob() {
  // Run once on startup
  cleanupExpiredBlacklistTokens();
  // Then periodically
  setInterval(cleanupExpiredBlacklistTokens, CLEANUP_INTERVAL_MS);
}
