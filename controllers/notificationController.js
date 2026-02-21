import prisma from "../utils/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {statusCode} from "../utils/statusCode.js";
import { ensureVapidKeys, getVapidPublicKey, sendPush } from "../utils/notificationService.js";

export const getVapidPublic = asyncHandler(async (req, res) => {
  const key = getVapidPublicKey();
  return res.status(statusCode.Ok200).json({ publicKey: key });
});

export const subscribe = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });
  const sub = req.body;
  const endpoint = sub?.endpoint;
  const keys = sub?.keys || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(statusCode.BadRequest400).json({ message: "Invalid subscription" });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return res.status(statusCode.Ok200).json({ message: "Subscribed" });
});

export const sendTest = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(statusCode.Unauthorized401).json({ message: "Unauthorized" });
  ensureVapidKeys();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const payload = req.body?.payload || { title: "HerGuardian", body: "Test notification" };
  let sent = 0;
  for (const s of subs) {
    try {
      await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (_e) {
      // Push delivery failure — non-critical, continue with remaining subscriptions
    }
  }
  return res.status(statusCode.Ok200).json({ sent });
});
