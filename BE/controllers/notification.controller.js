const Notification = require("../models/notification.model");

// GET /api/notifications?filter=all|unread&includeDeleted=true
const getNotifications = async (req, res) => {
  try {
    const me = req.user.id;
    const filter = req.query.filter === "unread" ? "unread" : "all";
    const includeDeleted = req.query.includeDeleted === "true";

    const query = { recipient: me };
    if (!includeDeleted) query.isView = { $ne: false };
    if (filter === "unread") query.isRead = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    // Unread badge always counts live (non-deleted) notifications only.
    const unreadCount = await Notification.countDocuments({
      recipient: me,
      isRead: false,
      isView: { $ne: false },
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/notifications/read/:id   body: { isRead?: boolean }  (default true)
const setRead = async (req, res) => {
  try {
    const isRead = req.body.isRead === undefined ? true : !!req.body.isRead;

    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { $set: { isRead } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({
      success: true,
      message: isRead ? "Marked as read" : "Marked as unread",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false, isView: { $ne: false } },
      { $set: { isRead: true } },
    );
    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/notifications/:id   — soft delete (hide from this user's list)
const deleteNotification = async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { $set: { isView: false } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, message: "Notification removed", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/notifications/:id/restore  — bring a deleted notification back
const restoreNotification = async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { $set: { isView: true } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, message: "Notification restored", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNotifications,
  setRead,
  markAllRead,
  deleteNotification,
  restoreNotification,
};
