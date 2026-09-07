const User = require("../models/user.model");
const { ERole, ALL_PERMISSIONS, DEFAULT_USER_PERMISSIONS } = require("../constants");

/**
 * One-time backfill so the permission system doesn't lock anyone out:
 *  - every SA doc gets the full key list (display only — SA bypasses checks)
 *  - every other doc missing `permissions` gets the fixed employee default,
 *    which equals what they could already do.
 * Idempotent — safe to run on every boot.
 */
async function seedUserPermissions() {
  try {
    // Every SA doc gets the full key list (display only). Re-run whenever the
    // registry grows so new keys show up on the Permissions screen for SA.
    const sa = await User.updateMany(
      {
        role: ERole.SA,
        $or: [
          { permissions: { $exists: false } },
          { permissions: { $not: { $size: ALL_PERMISSIONS.length } } },
        ],
      },
      { $set: { permissions: ALL_PERMISSIONS } },
    );

    const rest = await User.updateMany(
      { role: { $ne: ERole.SA }, permissions: { $exists: false } },
      { $set: { permissions: DEFAULT_USER_PERMISSIONS } },
    );

    const touched = (sa.modifiedCount || 0) + (rest.modifiedCount || 0);
    if (touched > 0) {
      console.log(`🔑 Permission backfill: ${touched} user(s) initialised`);
    }
  } catch (error) {
    console.log("⚠️  Permission backfill skipped:", error.message);
  }
}

module.exports = { seedUserPermissions };
