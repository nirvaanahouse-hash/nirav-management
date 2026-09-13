const { getSettings } = require("../models/ipSetting.model");
const { getClientIp, isLoopback, isPrivateLan } = require("../utils/ip");

// Hand-rolled fixed-window rate limiter. In-memory and single-process — fine
// for this single-instance internal tool. Keyed by "<bucket>:<ip>".

const hits = new Map();

// Periodically drop expired windows so the Map can't grow without bound.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now >= entry.resetAt) hits.delete(key);
  }
}, 60000);
if (typeof sweeper.unref === "function") sweeper.unref();

/**
 * @param {object}   opts
 * @param {string}   opts.bucket             namespace for the counter
 * @param {function} opts.getMax             (settings) => number   (<= 0 means unlimited)
 * @param {function} [opts.getWindowMs]      (settings) => number
 * @param {boolean}  [opts.bypassPrivateLan] skip the whole private LAN, not just loopback
 */
function rateLimit({ bucket, getMax, getWindowMs, bypassPrivateLan = false }) {
  return async (req, res, next) => {
    let settings;
    try {
      settings = await getSettings();
    } catch (err) {
      return next(); // fail open
    }

    if (!settings.rateLimitEnabled) return next();

    const max = Number(getMax(settings));
    if (!Number.isFinite(max) || max <= 0) return next();

    const windowMs = Math.max(
      1000,
      Number((getWindowMs ? getWindowMs(settings) : settings.rateLimitWindowMs)) || 60000,
    );

    const ip = getClientIp(req) || "unknown";
    // Loopback is always exempt; the general limiter also exempts the trusted
    // private LAN (this is an internal same-WiFi tool — a logged-in SPA makes
    // far more than a few hundred calls/min in normal use).
    if (isLoopback(ip) || (bypassPrivateLan && isPrivateLan(ip))) return next();

    const key = `${bucket}:${ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }
    entry.count += 1;
    hits.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const resetSec = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSec));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(resetSec));
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please slow down and try again shortly.",
      });
    }

    return next();
  };
}

const authRateLimit = rateLimit({
  bucket: "auth",
  getMax: (s) => s.authRateLimitMax,
  getWindowMs: (s) => s.rateLimitWindowMs,
});

const generalRateLimit = rateLimit({
  bucket: "api",
  getMax: (s) => s.rateLimitMax,
  getWindowMs: (s) => s.rateLimitWindowMs,
  bypassPrivateLan: true,
});

module.exports = { rateLimit, authRateLimit, generalRateLimit };
