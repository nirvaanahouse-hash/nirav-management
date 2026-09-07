const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      trim: true,
    },

    ticketId: {
      type: String,
      trim: true,
    },

    actorId: {
      type: String,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    // Per-recipient soft delete — a deleted notification stays in the DB but is
    // hidden from the normal list ("Show deleted" reveals it again).
    isView: {
      type: Boolean,
      default: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Notification", notificationSchema);
