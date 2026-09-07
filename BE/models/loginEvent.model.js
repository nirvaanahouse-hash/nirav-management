const mongoose = require("mongoose");

// One row per login attempt (successful or not) — powers the "Login Activity"
// view. Writes are fire-and-forget from the auth controller.

const loginEventSchema = new mongoose.Schema(
  {
    userId: { type: String, trim: true },
    userName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, trim: true },

    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },

    success: { type: Boolean, default: false },
    // Short human reason: "ok", "User not found", "Invalid password", "Account deactivated".
    reason: { type: String, trim: true },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

loginEventSchema.index({ userId: 1, createdAt: -1 });
loginEventSchema.index({ ip: 1, createdAt: -1 });
loginEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("LoginEvent", loginEventSchema);
