const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/permission.middleware");
const { mongoIdParam } = require("../middleware/validate.middleware");
const {
  getNotifications,
  setRead,
  markAllRead,
  deleteNotification,
  restoreNotification,
} = require("../controllers/notification.controller");

// Scoped to "/notifications" so it never gates other routers on the same "/api".
router.use("/notifications", requirePermission("notifications.view"));

router.get("/notifications", getNotifications);
router.put("/notifications/read-all", markAllRead);
router.put("/notifications/read/:id", mongoIdParam, setRead);
router.put("/notifications/:id/restore", mongoIdParam, restoreNotification);
router.delete("/notifications/:id", mongoIdParam, deleteNotification);

module.exports = router;
