const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/permission.middleware");
const { getRegistry, getMyPermissions } = require("../controllers/permission.controller");

// The caller's own effective permissions — any authenticated user.
router.get("/permissions/me", getMyPermissions);

// Full registry — only needed by the Permissions admin screen.
router.get("/permissions", requirePermission("users.permissions"), getRegistry);

module.exports = router;
