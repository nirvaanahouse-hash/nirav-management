const TicketType = require("../models/ticketType.model");
const { BADGE_VARIANT_COLORS } = require("../constants");

// The registry is read on nearly every ticket request but changes only when an
// SA edits it, so it is cached in-process and dropped on every write.
const CACHE_TTL_MS = 60 * 1000;

let cache = null;
let cachedAt = 0;

function invalidateTicketTypeCache() {
  cache = null;
  cachedAt = 0;
}

/** Every ticket type, active or not, in display order. */
async function getTicketTypes() {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cache;
  }
  cache = await TicketType.find().sort({ sortOrder: 1, label: 1 }).lean();
  cachedAt = Date.now();
  return cache;
}

/** Only the types an SA still offers on the ticket form. */
async function getActiveTicketTypes() {
  const types = await getTicketTypes();
  return types.filter((t) => t.isActive);
}

/** `{ [key]: typeDoc }` for label / colour lookups while enriching tickets. */
async function getTicketTypeMap() {
  const types = await getTicketTypes();
  const map = {};
  types.forEach((t) => {
    map[t.key] = t;
  });
  return map;
}

/** Hex colour for a type doc — charts and PDFs need a real colour. */
function ticketTypeColor(type) {
  return BADGE_VARIANT_COLORS[type?.variant] || BADGE_VARIANT_COLORS.neutral;
}

/**
 * Stored key for a new type: "Baby Shower JOB" → "babyShowerJob".
 * Hour-wise types always end in "Job" — that suffix is how the rest of the
 * app (validators, pricing, the ticket form) recognises them.
 */
function buildTicketTypeKey(label, isJob) {
  const words = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "";
  }

  const key = words
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");

  if (isJob && !key.endsWith("Job")) {
    return `${key}Job`;
  }
  return key;
}

module.exports = {
  getTicketTypes,
  getActiveTicketTypes,
  getTicketTypeMap,
  ticketTypeColor,
  buildTicketTypeKey,
  invalidateTicketTypeCache,
};
