const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const authMiddleware = require("./middleware/auth.middleware");
const errorHandler = require("./middleware/errorHandler.middleware");
const ipGuard = require("./middleware/ipGuard.middleware");
const requestLog = require("./middleware/requestLog.middleware");
const { authRateLimit, generalRateLimit } = require("./middleware/rateLimit.middleware");

const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const ticketRoutes = require("./routes/ticket.routes");
const clientRoutes = require("./routes/client.routes");
const employeeRoutes = require("./routes/employee.routes");
const notificationRoutes = require("./routes/notification.routes");
const amountEntryRoutes = require("./routes/amountEntry.routes");
const ipRoutes = require("./routes/ip.routes");
const permissionRoutes = require("./routes/permission.routes");
const comparisonRoutes = require("./routes/comparison.routes");
const { seedUserPermissions } = require("./utils/seed-permissions");

const app = express();

connectDB();
// One-time, idempotent backfill so nobody is locked out by the permission layer.
seedUserPermissions();

// Needed so req.ip reflects the real client behind a LAN proxy / phone.
app.set("trust proxy", process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal");

app.use(cookieParser());

// Allow the Angular dev server on localhost AND on the LAN IP (same WiFi devices).
// FRONTEND_URL may be a comma-separated list of allowed origins.
const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:4200,http://192.168.1.73:4200"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, mobile webview) send no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Also allow any private LAN origin on the dev port, so the IP can change.
      if (/^http:\/\/(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)[\d.]+:4200$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IP allow / block guard — no-op unless enabled from the security settings.
app.use(ipGuard);

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Server Running Successfully 🚀" });
});

// Public routes (stricter per-IP throttle to slow login brute-forcing)
app.use("/api/auth", authRateLimit, authRoutes);

// Authenticated routes
app.use(authMiddleware);
app.use(generalRateLimit);
app.use(requestLog);
app.use("/api", profileRoutes);
app.use("/api", ticketRoutes);
app.use("/api", clientRoutes);
app.use("/api", employeeRoutes);
app.use("/api", notificationRoutes);
app.use("/api", amountEntryRoutes);
app.use("/api", ipRoutes);
app.use("/api", permissionRoutes);
app.use("/api", comparisonRoutes);

app.use(errorHandler);

module.exports = app;
