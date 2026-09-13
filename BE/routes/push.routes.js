const express = require("express");
const router = express.Router();
const { getPublicKey, subscribe, unsubscribe } = require("../controllers/push.controller");

// No fine-grained permission gate — every authenticated user manages their
// own subscriptions only (scoped to req.user.id in the controller).
router.get("/push/public-key", getPublicKey);
router.post("/push/subscribe", subscribe);
router.delete("/push/subscribe", unsubscribe);

module.exports = router;
