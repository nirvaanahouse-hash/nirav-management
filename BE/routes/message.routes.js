const express = require("express");
const router = express.Router();
const { validateParams } = require("../middleware/validate.middleware");
const { getContacts, getThread, sendMessage, markRead } = require("../controllers/message.controller");

// mongoIdParam validates a param literally named "id" — this router's param
// is "withUserId", so it needs its own schema instead.
const withUserIdParam = validateParams({
  withUserId: { required: true, mongoId: true, label: "User ID" },
});

// No fine-grained permission gate — every authenticated user has their own
// inbox, and every handler scopes to req.user.id itself (see the
// controller), so there is nothing here a permission check would add.
// "contacts" is registered before "/:withUserId" so it isn't swallowed by it.
router.get("/messages/contacts", getContacts);
router.get("/messages/:withUserId", withUserIdParam, getThread);
router.post("/messages", sendMessage);
router.put("/messages/read/:withUserId", withUserIdParam, markRead);

module.exports = router;
