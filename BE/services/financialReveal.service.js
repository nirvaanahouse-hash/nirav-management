const crypto = require("crypto");

// In-memory and single-process — this is a screen-privacy gate, not a
// security boundary (an SA who can already call the API can already see this
// data), so it doesn't need to survive a restart or work across instances.
const OTP_TTL_MS = 2 * 60 * 1000; // time to enter the code
const REVEAL_TTL_MS = 5 * 60 * 1000; // how long financial figures stay revealed
const MAX_ATTEMPTS = 5;

const pending = new Map(); // userId -> { hash, expiresAt, attempts }

const hash = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

function createOtp(userId) {
  const otp = String(crypto.randomInt(100000, 1000000));
  pending.set(userId, { hash: hash(otp), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
  return otp;
}

function verifyOtp(userId, submitted) {
  const entry = pending.get(userId);
  if (!entry) {
    return { ok: false, message: "Request a new code — none is pending." };
  }
  if (Date.now() > entry.expiresAt) {
    pending.delete(userId);
    return { ok: false, message: "That code expired — request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    pending.delete(userId);
    return { ok: false, message: "Too many incorrect attempts — request a new code." };
  }

  entry.attempts += 1;
  if (hash(String(submitted || "")) !== entry.hash) {
    return { ok: false, message: "Incorrect code." };
  }

  pending.delete(userId); // single use
  return { ok: true, revealUntil: Date.now() + REVEAL_TTL_MS };
}

module.exports = { createOtp, verifyOtp, OTP_TTL_MS, REVEAL_TTL_MS };
