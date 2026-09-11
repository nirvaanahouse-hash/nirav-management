// Permission registry — the single source of truth for every fine-grained
// capability in the project. Mirrored on the frontend at
// studio-management/src/app/core/constants/permissions.ts (keep in sync).
//
// The Super Admin (ERole.SA) is never checked against this list — SA always
// has full access (see utils/permissions.js + middleware/permission.middleware.js).

const PERMISSION_GROUPS = [
  {
    key: "dashboard",
    label: "Dashboard",
    permissions: [
      { key: "dashboard.sa.view", label: "View company dashboard (revenue, profit, balances)" },
      { key: "dashboard.self.view", label: "View personal dashboard" },
    ],
  },
  {
    key: "tickets",
    label: "Tickets",
    permissions: [
      { key: "tickets.view", label: "View tickets" },
      { key: "tickets.viewAll", label: "View all tickets + financial figures" },
      { key: "tickets.create", label: "Create tickets" },
      { key: "tickets.edit", label: "Edit tickets" },
      { key: "tickets.delete", label: "Delete tickets" },
      { key: "tickets.assign", label: "Assign an employee to a ticket" },
      { key: "tickets.complete", label: "Mark a ticket complete" },
      { key: "tickets.finalize", label: "Finalise a ticket (lock financials)" },
      { key: "tickets.comment", label: "Comment on tickets" },
      { key: "tickets.types.manage", label: "Add / remove ticket types" },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    permissions: [
      { key: "clients.view", label: "View clients" },
      { key: "clients.create", label: "Create clients" },
      { key: "clients.edit", label: "Edit / reactivate clients" },
      { key: "clients.delete", label: "Deactivate clients" },
      { key: "clients.billing", label: "Client billing & invoice PDFs" },
    ],
  },
  {
    key: "users",
    label: "Users",
    permissions: [
      { key: "users.view", label: "View users" },
      { key: "users.edit", label: "Edit user details & role" },
      { key: "users.status", label: "Activate / deactivate users" },
      { key: "users.password", label: "Set / reset user passwords" },
      { key: "users.percentage", label: "Set user profit-share %" },
      { key: "users.permissions", label: "Manage user permissions" },
      { key: "users.location", label: "See users' live location" },
    ],
  },
  {
    key: "amounts",
    label: "Ledger / amount entries",
    permissions: [
      { key: "amounts.view", label: "View amount entries" },
      { key: "amounts.create", label: "Create amount entries" },
      { key: "amounts.edit", label: "Edit amount entries" },
      { key: "amounts.delete", label: "Delete amount entries" },
      { key: "amounts.summary.sa", label: "View studio-wide ledger totals" },
      { key: "amounts.summary.self", label: "View own ledger summary" },
    ],
  },
  {
    key: "profile",
    label: "Profile",
    permissions: [
      { key: "profile.view", label: "View own profile" },
      { key: "profile.edit", label: "Edit own profile" },
    ],
  },
  {
    key: "notifications",
    label: "Notifications",
    permissions: [{ key: "notifications.view", label: "View notifications" }],
  },
  {
    key: "security",
    label: "IP & Security",
    permissions: [
      { key: "security.view", label: "Open the IP & Security area" },
      { key: "security.rules.manage", label: "Manage IP allow / block rules" },
      { key: "security.settings.manage", label: "Change guard & rate-limit settings" },
      { key: "security.logs.view", label: "View login activity & request logs" },
    ],
  },
  {
    key: "comparison",
    label: "Comparison",
    permissions: [
      { key: "comparison.view", label: "Compare employees (work & earnings leaderboard)" },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

// The fixed capability set every newly-registered (non-SA) user starts with.
// This MUST equal what an employee (ERole.U) can already do today, so existing
// users are unaffected once backfilled.
const DEFAULT_USER_PERMISSIONS = [
  "dashboard.self.view",
  "tickets.view",
  "tickets.create",
  "tickets.edit",
  "tickets.complete",
  "tickets.comment",
  "amounts.view",
  "amounts.create",
  "amounts.edit",
  "amounts.delete",
  "amounts.summary.self",
  "profile.view",
  "profile.edit",
  "notifications.view",
];

module.exports = {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
};
