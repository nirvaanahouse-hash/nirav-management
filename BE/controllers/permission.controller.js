const User = require("../models/user.model");
const {
  ERole,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
} = require("../constants");
const { effectivePermissions } = require("../utils/permissions");

const ALL_SET = new Set(ALL_PERMISSIONS);

// GET /api/permissions — the full registry (for the Permissions admin screen)
const getRegistry = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      groups: PERMISSION_GROUPS,
      all: ALL_PERMISSIONS,
      defaultUser: DEFAULT_USER_PERMISSIONS,
    },
  });
};

// GET /api/permissions/me — the caller's effective permissions
const getMyPermissions = async (req, res) => {
  const isSuperAdmin = req.user.role === ERole.SA;
  return res.status(200).json({
    success: true,
    data: {
      isSuperAdmin,
      permissions: effectivePermissions(req.user),
    },
  });
};

// GET /api/employees/:id/permissions
const getUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("role permissions").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const isSuperAdmin = user.role === ERole.SA;
    return res.status(200).json({
      success: true,
      data: {
        isSuperAdmin,
        permissions: isSuperAdmin
          ? [...ALL_PERMISSIONS]
          : Array.isArray(user.permissions)
            ? user.permissions
            : [...DEFAULT_USER_PERMISSIONS],
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/employees/:id/permissions   body: { permissions: string[] }
const setUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role === ERole.SA) {
      return res.status(400).json({
        success: false,
        message: "The Super Admin always has full access — permissions cannot be edited.",
      });
    }

    const incoming = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    // Keep only known keys, de-duplicated, in registry order.
    const cleaned = ALL_PERMISSIONS.filter((k) => incoming.includes(k));

    user.permissions = cleaned;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Permissions updated",
      data: { permissions: cleaned },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRegistry,
  getMyPermissions,
  getUserPermissions,
  setUserPermissions,
};
