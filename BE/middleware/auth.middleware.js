const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
  try {
    // Bearer header is the primary path (works cross-site even under
    // Safari's ITP, which blocks the cookie once frontend/backend are on
    // different *.onrender.com "sites"); the cookie stays as a fallback for
    // same-site/local-dev requests that never set the header.
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const token = bearerToken || req.cookies.token;

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
