const webpush = require("web-push");
const PushSubscription = require("../models/pushSubscription.model");

const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn("[push] VAPID keys not set — browser push notifications are disabled.");
}

/**
 * Push a notification to every browser this user has subscribed from —
 * unlike the in-app notification bell (Socket.IO), this reaches the user
 * even when the tab is backgrounded or the browser is closed, as long as
 * their OS/browser allows background push. Best-effort: a dead
 * subscription (the browser revoked it — 404/410) is pruned; anything else
 * is swallowed so a push failure never breaks the caller's own action
 * (creating a notification, sending a chat message, ...).
 */
const sendPushToUser = async (userId, payload) => {
  if (!configured || !userId) return;

  const subs = await PushSubscription.find({ user: userId }).lean();
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    }),
  );
};

module.exports = {
  sendPushToUser,
  isPushConfigured: () => configured,
};
