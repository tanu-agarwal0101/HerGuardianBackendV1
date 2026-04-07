import prisma from "../utils/prisma.js";
import logger from "../utils/logger.js";


const activityCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; 
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [userId, timestamp] of activityCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      activityCache.delete(userId);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    logger.debug({ deletedCount, newSize: activityCache.size }, "Activity cache cleaned");
  }
}, CACHE_TTL);


export const activityTracker = async (req, res, next) => {
  if (!req.user || !req.user.userId) return next();

  const userId = req.user.userId;
  const now = Date.now();
  const lastActive = activityCache.get(userId);


  if (!lastActive || (now - lastActive > 60 * 1000)) {
    
    if (activityCache.size > 10000) {
      const entriesToEvict = Math.ceil(activityCache.size * 0.1);
      const sortedEntries = [...activityCache.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, entriesToEvict);
      
      for (const [key] of sortedEntries) {
        activityCache.delete(key);
      }
      logger.info({ evicted: entriesToEvict, newSize: activityCache.size }, "Activity cache trimmed (hard size limit reached)");
    }
    
    activityCache.set(userId, now);
    prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    }).catch(err => {
      logger.error({ err, userId }, "Failed to update lastActiveAt");
    });
  }

  next();
};
