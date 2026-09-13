// IP helpers — client-IP extraction, validation and CIDR matching.
// Kept dependency-free and hand-rolled, matching utils/validate.js.

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
// Permissive IPv6 — good enough to accept real addresses, reject obvious junk.
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/**
 * Strip the IPv4-mapped IPv6 prefix Node adds ("::ffff:192.168.1.5" -> "192.168.1.5")
 * and trim surrounding whitespace.
 */
function normalizeIp(ip) {
  if (!ip || typeof ip !== "string") return "";
  let out = ip.trim();
  const mapped = out.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) out = mapped[1];
  return out;
}

/**
 * Best-effort client IP. Express already resolves `req.ip` against the
 * configured `trust proxy` setting, so prefer it and fall back to the socket.
 */
function getClientIp(req) {
  const raw =
    (req && req.ip) ||
    (req && req.socket && req.socket.remoteAddress) ||
    (req && req.connection && req.connection.remoteAddress) ||
    "";
  return normalizeIp(raw);
}

function isValidIpv4(value) {
  const m = String(value).match(IPV4_RE);
  if (!m) return false;
  return m.slice(1).every((oct) => {
    const n = Number(oct);
    return n >= 0 && n <= 255 && String(n) === String(Number(oct));
  });
}

function isValidIpv6(value) {
  const v = String(value);
  return v.includes(":") && IPV6_RE.test(v) && v.length <= 45;
}

function isValidIp(value) {
  const v = normalizeIp(value);
  return isValidIpv4(v) || isValidIpv6(v);
}

function isValidCidr(value) {
  const v = String(value);
  const slash = v.indexOf("/");
  if (slash === -1) return false;
  const addr = v.slice(0, slash);
  const prefix = Number(v.slice(slash + 1));
  if (!Number.isInteger(prefix)) return false;
  if (isValidIpv4(addr)) return prefix >= 0 && prefix <= 32;
  if (isValidIpv6(addr)) return prefix >= 0 && prefix <= 128;
  return false;
}

function isValidIpOrCidr(value) {
  return isValidIp(value) || isValidCidr(value);
}

function ipv4ToInt(ip) {
  return normalizeIp(ip)
    .split(".")
    .reduce((acc, oct) => (acc << 8) + (Number(oct) & 255), 0) >>> 0;
}

/**
 * IPv4 CIDR containment via integer math. Returns false for anything that
 * isn't a plain IPv4 address inside an IPv4 CIDR block.
 */
function ipInCidr(ip, cidr) {
  const addr = normalizeIp(ip);
  const [range, bitsRaw] = String(cidr).split("/");
  const bits = Number(bitsRaw);
  if (!isValidIpv4(addr) || !isValidIpv4(range) || !Number.isInteger(bits)) {
    return false;
  }
  if (bits <= 0) return true;
  if (bits > 32) return false;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(addr) & mask) === (ipv4ToInt(range) & mask);
}

/**
 * Does `ip` match a stored rule value? Rule values are either an exact
 * IP (v4/v6) or an IPv4 CIDR block.
 */
function ipMatchesRule(ip, ruleValue) {
  if (!ip || !ruleValue) return false;
  const value = String(ruleValue).trim();
  if (value.includes("/")) return ipInCidr(ip, value);
  return normalizeIp(ip) === normalizeIp(value);
}

function isLoopback(ip) {
  const v = normalizeIp(ip);
  if (v === "::1" || v === "0:0:0:0:0:0:0:1") return true;
  return isValidIpv4(v) && v.startsWith("127.");
}

function isPrivateLan(ip) {
  const v = normalizeIp(ip);
  if (isLoopback(v)) return true;
  if (!isValidIpv4(v)) return false;
  return (
    v.startsWith("10.") ||
    v.startsWith("192.168.") ||
    v.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v)
  );
}

module.exports = {
  normalizeIp,
  getClientIp,
  isValidIpv4,
  isValidIpv6,
  isValidIp,
  isValidCidr,
  isValidIpOrCidr,
  ipv4ToInt,
  ipInCidr,
  ipMatchesRule,
  isLoopback,
  isPrivateLan,
};
