const { ERole } = require('../constants');

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(role) ? role : [role];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
    }

    next();
  };
};

const requireSA = requireRole(ERole.SA);
const requireAdmin = requireRole([ERole.SA, ERole.A]);

module.exports = { requireRole, requireSA, requireAdmin };
