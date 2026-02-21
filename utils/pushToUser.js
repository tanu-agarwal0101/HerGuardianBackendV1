import prisma from "./prisma.js";
import { sendPush } from "./notificationService.js";

/**
 * Send a push notification to ALL active subscriptions for a given userId.
 * Silently removes stale/invalid subscriptions (HTTP 410 Gone).
 */
export async function notifyUser(userId, payload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await sendPush(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err) {
        // 410 Gone = browser unsubscribed; clean up stale subscription
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}
