const PushSubscription = require("../models/pushSubscription.model");
const { isPushConfigured } = require("../services/push.service");

// GET /api/push/public-key
const getPublicKey = (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      publicKey: process.env.VAPID_PUBLIC_KEY || "",
      enabled: isPushConfigured(),
    },
  });
};

// POST /api/push/subscribe — called once the browser grants permission and
// creates a PushSubscription. Upserted by endpoint so re-subscribing on the
// same browser (e.g. after clearing site data) never creates a duplicate row.
const subscribe = async (req, res) => {
  try {
    const { user } = req;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: "A valid push subscription is required." });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: user.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true },
    );

    return res.status(200).json({ success: true, message: "Subscribed to push notifications." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/push/subscribe — called when the user turns notifications off.
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: "endpoint is required." });
    }
    await PushSubscription.deleteOne({ endpoint, user: req.user.id });
    return res.status(200).json({ success: true, message: "Unsubscribed." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getPublicKey, subscribe, unsubscribe };
