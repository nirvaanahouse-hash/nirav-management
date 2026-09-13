const { hasAnyPermission } = require("../utils/permissions");

/**
 * Route guard: allow the request only if the user is the Super Admin (bypass)
 * or holds at least one of the listed permission keys.
 *
 *   router.delete("/ticket/:id", requirePermission("tickets.delete"), deleteTicket);
 */
const requirePermission = (...keys) => {
  const needed = keys.flat().filter(Boolean);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (hasAnyPermission(req.user, needed)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action.",
      need: needed,
    });
  };
};

module.exports = { requirePermission };
