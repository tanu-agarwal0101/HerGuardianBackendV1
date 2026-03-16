import logger from "./logger.js";
import webpush from "web-push";

let vapidPublic = (process.env.VAPID_PUBLIC_KEY || "").replace(/\s/g, "");
let vapidPrivate = (process.env.VAPID_PRIVATE_KEY || "").replace(/\s/g, "");

export function ensureVapidKeys() {
  if (!vapidPublic || !vapidPrivate) {
    const keys = webpush.generateVAPIDKeys();
    vapidPublic = keys.publicKey;
    vapidPrivate = keys.privateKey;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      vapidPublic,
      vapidPrivate
    );
  } catch (err) {
    logger.error({ err }, "Failed to set VAPID details. Push notifications may not work");
  }
}

export function getVapidPublicKey() {
  ensureVapidKeys();
  return vapidPublic;
}

export async function sendPush(subscription, payload) {
  ensureVapidKeys();
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}


