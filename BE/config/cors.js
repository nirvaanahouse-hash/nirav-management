// Single source of truth for which browser origins may call the API and open
// a Socket.IO connection with credentials.
//
// - FRONTEND_URL may be a single origin or a comma-separated list.
// - localhost:4200 (dev) is always allowed.
// - Any private-LAN origin on :4200 is allowed (phone / same-WiFi testing).
// - Any https://*.onrender.com host is allowed (deployed frontend).

const staticOrigins = [
  "http://localhost:4200",
  "http://127.0.0.1:4200",
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),
];

const originPatterns = [
  /^http:\/\/(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)[\d.]+:4200$/,
  /^https:\/\/[a-z0-9-]+\.onrender\.com$/i,
];

const isAllowedOrigin = (origin) => {
  // No Origin header: curl, server-to-server, same-origin, mobile webview.
  if (!origin) return true;
  if (staticOrigins.includes(origin)) return true;
  return originPatterns.some((re) => re.test(origin));
};

// Ready-made config object for the `cors` middleware and Socket.IO.
const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
  // Custom response headers aren't readable cross-origin by default — the
  // backup download reports its Drive-upload outcome via this one.
  exposedHeaders: ["X-Drive-Status"],
};

module.exports = { isAllowedOrigin, corsOptions, staticOrigins };
