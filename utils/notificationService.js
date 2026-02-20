import webpush from "web-push";

let vapidPublic = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivate = process.env.VAPID_PRIVATE_KEY || "";

export function ensureVapidKeys() {
  if (!vapidPublic || !vapidPrivate) {
    const keys = webpush.generateVAPIDKeys();
    vapidPublic = keys.publicKey;
    vapidPrivate = keys.privateKey;
    // eslint-disable-next-line no-console
    console.log("Generated ephemeral VAPID keys. Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY for production.");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    vapidPublic,
    vapidPrivate
  );
}

export function getVapidPublicKey() {
  ensureVapidKeys();
  return vapidPublic;
}

export async function sendPush(subscription, payload) {
  ensureVapidKeys();
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}


