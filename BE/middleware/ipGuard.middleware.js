const IpRule = require("../models/ipRule.model");
const { getSettings } = require("../models/ipSetting.model");
const { getClientIp, isLoopback, ipMatchesRule } = require("../utils/ip");

// Active rules are cached briefly so the guard doesn't hit Mongo on every
// request. Mutations in ip.controller.js call invalidateIpRuleCache() for
// immediate effect; otherwise the cache self-refreshes.
const CACHE_TTL_MS = 5000;
let rulesCache = null;
let rulesCachedAt = 0;

async function loadActiveRules() {
  const now = Date.now();
  if (rulesCache && now - rulesCachedAt < CACHE_TTL_MS) return rulesCache;
  try {
    rulesCache = await IpRule.find({ isActive: true }).select("ip mode").lean();
    rulesCachedAt = now;
  } catch (err) {
    rulesCache = rulesCache || [];
  }
  return rulesCache;
}

function invalidateIpRuleCache() {
  rulesCache = null;
  rulesCachedAt = 0;
}

/**
 * Decide whether an IP may pass, given the active rules.
 *  - Any matching "block" rule -> denied.
 *  - If any "allow" rule exists, the guard is in allowlist mode: only IPs that
 *    match an "allow" rule pass.
 *  - Otherwise everything not explicitly blocked passes.
 */
function evaluate(ip, rules) {
  const blocked = rules.some((r) => r.mode === "block" && ipMatchesRule(ip, r.ip));
  if (blocked) return { allowed: false, reason: "blocked" };

  const allowRules = rules.filter((r) => r.mode === "allow");
  if (allowRules.length > 0) {
    const onList = allowRules.some((r) => ipMatchesRule(ip, r.ip));
    return onList
      ? { allowed: true, reason: "allowlisted" }
      : { allowed: false, reason: "not-on-allowlist" };
  }

  return { allowed: true, reason: "default-open" };
}

async function ipGuard(req, res, next) {
  try {
    const settings = await getSettings();
    if (!settings.guardEnabled) return next();

    const ip = getClientIp(req);
    if (!ip || isLoopback(ip)) return next();

    const rules = await loadActiveRules();
    const verdict = evaluate(ip, rules);

    if (!verdict.allowed) {
      return res.status(403).json({
        success: false,
        message: "Your IP address is not permitted to access this service.",
        ip,
      });
    }

    return next();
  } catch (err) {
    // Fail open — a guard bug must never take the whole API down.
    return next();
  }
}

module.exports = ipGuard;
module.exports.invalidateIpRuleCache = invalidateIpRuleCache;
module.exports.evaluate = evaluate;
