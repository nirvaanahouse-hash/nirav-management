const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
  try {
    // Authorization header only — no cookie fallback. The frontend keeps
    // the token in sessionStorage and sends it explicitly on every request
    // (studio-management's auth.interceptor.ts), which also sidesteps
    // Safari's ITP and every other cross-site-cookie quirk entirely.
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        isInvalid: true,
        message: "Unauthorized. Token not found.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password").lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        isInvalid: true,
        message: "User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        isInvalid: true,
        message: "Your account has been deactivated.",
      });
    }

    // Flat auth context — every controller reads these directly off req.user.
    // Role comes from the fresh DB doc, never the (possibly stale) token.
    req.user = {
      id: String(user._id),
      _id: user._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email,
      isActive: user.isActive,
      // Fine-grained permissions — empty array for legacy docs (SA ignores this).
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      isInvalid: true,
      message: "Invalid or Expired Token",
    });
  }
};

module.exports = authMiddleware;
