const dotenv = require("dotenv");
dotenv.config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const { UPLOADS_ROOT } = require("./middleware/upload.middleware");

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
const locationRoutes = require("./routes/location.routes");
const ipRoutes = require("./routes/ip.routes");
const permissionRoutes = require("./routes/permission.routes");
const comparisonRoutes = require("./routes/comparison.routes");
const ticketTypeRoutes = require("./routes/ticketType.routes");
const financialRevealRoutes = require("./routes/financialReveal.routes");
const { seedUserPermissions } = require("./utils/seed-permissions");
const { seedTicketTypes } = require("./utils/seed-ticket-types");

const app = express();

connectDB();
// One-time, idempotent backfill so nobody is locked out by the permission layer.
seedUserPermissions();
// First-boot copy of the built-in ticket types into their SA-managed collection.
seedTicketTypes();

// Needed so req.ip reflects the real client behind a LAN proxy / phone.
app.set("trust proxy", process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal");

// Allowed browser origins (localhost dev, LAN testing, deployed frontend).
// See config/cors.js — FRONTEND_URL may be a comma-separated list.
const { corsOptions } = require("./config/cors");
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IP allow / block guard — no-op unless enabled from the security settings.
app.use(ipGuard);

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Server Running Successfully 🚀" });
});

// Uploaded profile photos — public, read-only static files (kept out of Mongo).
// Mounted before authMiddleware since a plain <img> tag can't attach an
// Authorization header — these just aren't an authenticated route at all.
app.use(
  "/uploads",
  express.static(UPLOADS_ROOT, {
    fallthrough: false,
    maxAge: "7d",
    index: false,
    dotfiles: "ignore",
  }),
);

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
app.use("/api", locationRoutes);
app.use("/api", ipRoutes);
app.use("/api", permissionRoutes);
app.use("/api", comparisonRoutes);
app.use("/api", ticketTypeRoutes);
app.use("/api", financialRevealRoutes);

app.use(errorHandler);

module.exports = app;
