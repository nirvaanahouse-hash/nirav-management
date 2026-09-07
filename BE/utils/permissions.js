const { ERole, ALL_PERMISSIONS } = require("../constants");

// The Super Admin is never restricted — every check short-circuits to true.
function isSuperAdmin(user) {
  return !!user && user.role === ERole.SA;
}

/**
 * Does this user hold a given permission key?
 * @param {{role?: string, permissions?: string[]}} user  req.user
 * @param {string} key                                    a key from ALL_PERMISSIONS
 */
function hasPermission(user, key) {
  if (isSuperAdmin(user)) return true;
  return Array.isArray(user && user.permissions) && user.permissions.includes(key);
}

/** True when the user holds at least one of the given keys. */
function hasAnyPermission(user, keys = []) {
  if (isSuperAdmin(user)) return true;
  const owned = new Set((user && user.permissions) || []);
  return keys.some((k) => owned.has(k));
}

/** The effective permission list (SA => every key). */
function effectivePermissions(user) {
  if (isSuperAdmin(user)) return [...ALL_PERMISSIONS];
  return Array.isArray(user && user.permissions) ? [...user.permissions] : [];
}

module.exports = {
  isSuperAdmin,
  hasPermission,
  hasAnyPermission,
  effectivePermissions,
};
