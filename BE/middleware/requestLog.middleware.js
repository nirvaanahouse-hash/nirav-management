const RequestLog = require("../models/requestLog.model");
const { getSettings } = require("../models/ipSetting.model");
const { getClientIp } = require("../utils/ip");

// Records one row per authenticated API request. Mounted AFTER authMiddleware
// so req.user is populated. Never blocks the response — the write happens on
// the "finish" event and errors are swallowed.
//
// Path is read from req.originalUrl at entry time: by the time "finish" fires,
// Express has stripped the "/api" mount prefix off req.url/req.path.

function requestLog(req, res, next) {
  const path = String(req.originalUrl || req.url || "").split("?")[0];

  // Don't log the SA reading the security dashboards back to themselves.
  if (req.method === "GET" && path.startsWith("/api/ip")) return next();

  const startedAt = Date.now();

  res.on("finish", () => {
    getSettings()
      .then((settings) => {
        if (!settings.logRequests) return;
        return RequestLog.create({
          userId: req.user ? req.user.id : undefined,
          userName: req.user
            ? `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
              req.user.userName
            : undefined,
          role: req.user ? req.user.role : undefined,
          ip: getClientIp(req),
          method: req.method,
          path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
          userAgent: req.headers["user-agent"],
        });
      })
      .catch(() => {});
  });

  return next();
}

module.exports = requestLog;
