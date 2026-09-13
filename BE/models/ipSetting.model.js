const mongoose = require("mongoose");

// Single-document collection holding the IP guard + rate-limit knobs the SA
// tunes from the admin UI. Read through getSettings() which caches for ~5s so
// per-request middleware doesn't hammer Mongo.

const DEFAULTS = {
  guardEnabled: false,
  rateLimitEnabled: true,
  rateLimitWindowMs: 60000,
  // Generous ceiling — the general limiter also skips the private LAN, so this
  // only ever bites a remote/abusive caller. A logged-in SPA is chatty.
  rateLimitMax: 3000,
  authRateLimitMax: 20,
  logRequests: true,
};

const ipSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "singleton",
      unique: true,
      immutable: true,
    },
    guardEnabled: { type: Boolean, default: DEFAULTS.guardEnabled },
    rateLimitEnabled: { type: Boolean, default: DEFAULTS.rateLimitEnabled },
    rateLimitWindowMs: { type: Number, default: DEFAULTS.rateLimitWindowMs },
    rateLimitMax: { type: Number, default: DEFAULTS.rateLimitMax },
    authRateLimitMax: { type: Number, default: DEFAULTS.authRateLimitMax },
    logRequests: { type: Boolean, default: DEFAULTS.logRequests },
  },
  { timestamps: true },
);

const IpSetting = mongoose.model("IpSetting", ipSettingSchema);

const CACHE_TTL_MS = 5000;
let cache = null;
let cachedAt = 0;

function shape(doc) {
  const src = doc || {};
  return {
    guardEnabled: src.guardEnabled ?? DEFAULTS.guardEnabled,
    rateLimitEnabled: src.rateLimitEnabled ?? DEFAULTS.rateLimitEnabled,
    rateLimitWindowMs: Number(src.rateLimitWindowMs ?? DEFAULTS.rateLimitWindowMs),
    rateLimitMax: Number(src.rateLimitMax ?? DEFAULTS.rateLimitMax),
    authRateLimitMax: Number(src.authRateLimitMax ?? DEFAULTS.authRateLimitMax),
    logRequests: src.logRequests ?? DEFAULTS.logRequests,
  };
}

/** Cached settings read. Never throws — falls back to defaults / last cache. */
async function getSettings() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_TTL_MS) return cache;
  try {
    const doc = await IpSetting.findOneAndUpdate(
      { key: "singleton" },
      { $setOnInsert: { key: "singleton" } },
      { new: true, upsert: true, lean: true },
    );
    cache = shape(doc);
    cachedAt = now;
    return cache;
  } catch (err) {
    return cache || shape(null);
  }
}

/** Persist a partial update and refresh the cache immediately. */
async function updateSettings(patch = {}) {
  const allowed = [
    "guardEnabled",
    "rateLimitEnabled",
    "rateLimitWindowMs",
    "rateLimitMax",
    "authRateLimitMax",
    "logRequests",
  ];
  const $set = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) $set[key] = patch[key];
  }
  const doc = await IpSetting.findOneAndUpdate(
    { key: "singleton" },
    { $set, $setOnInsert: { key: "singleton" } },
    { new: true, upsert: true, lean: true },
  );
  cache = shape(doc);
  cachedAt = Date.now();
  return cache;
}

module.exports = { IpSetting, getSettings, updateSettings, IP_SETTING_DEFAULTS: DEFAULTS };
