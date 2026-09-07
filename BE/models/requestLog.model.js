const mongoose = require("mongoose");

// One row per authenticated API request — powers the "Request Log" view.
// Auto-expires via a TTL index (REQUEST_LOG_TTL_DAYS, default 30). Changing the
// env var later needs the old TTL index dropped for Mongo to pick up the new value.

const TTL_DAYS = Math.max(1, Number(process.env.REQUEST_LOG_TTL_DAYS) || 30);

const requestLogSchema = new mongoose.Schema(
  {
    userId: { type: String, trim: true },
    userName: { type: String, trim: true },
    role: { type: String, trim: true },

    ip: { type: String, trim: true },
    method: { type: String, trim: true },
    path: { type: String, trim: true },
    statusCode: { type: Number },
    durationMs: { type: Number },
    userAgent: { type: String, trim: true },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

requestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_DAYS * 24 * 60 * 60 });
requestLogSchema.index({ createdAt: -1 });
requestLogSchema.index({ userId: 1, createdAt: -1 });
requestLogSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model("RequestLog", requestLogSchema);
