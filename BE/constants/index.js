// Central Backend Constants — single source of truth for validation, schemas, controllers

const ERole = {
  SA: "SA",
  A: "A",
  U: "U",
};

const ROLE_LABELS = {
  [ERole.SA]: "Super Admin",
  [ERole.A]: "Admin",
  [ERole.U]: "Employee",
};

const TICKET_TYPES = Object.freeze({
  weddingJob: "Wedding JOB",
  preweddingJob: "Prewedding JOB",
  babyShowerJob: "Baby Shower JOB",
  weddingHighlight: "Wedding HighLight",
  preweddingHighlight: "Prewedding HighLight",
  babyShowerHighlight: "Baby Shower HighLight",
  reels: "Reels",
  shortFilm: "Short Film",
});

const TICKET_TYPE_KEYS = Object.keys(TICKET_TYPES);

const TICKET_TYPE_LABELS = Object.values(TICKET_TYPES);

const PRIORITY = Object.freeze({
  low: "low",
  medium: "medium",
  high: "high",
});

const PRIORITY_VALUES = Object.values(PRIORITY);

const TICKET_STATUS = Object.freeze({
  pending: "pending",
  inProgress: "inProgress",
  completed: "completed",
  hold: "hold",
});

const TICKET_STATUS_VALUES = Object.values(TICKET_STATUS);

const TICKET_STATUS_LABELS = {
  pending: "Pending",
  inProgress: "In Progress",
  completed: "Completed",
  hold: "Hold",
};

const PRIORITY_COLORS = Object.freeze({
  high: "#E13B54",
  medium: "#D68A11",
  low: "#17A672",
});

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TICKET_TYPE_COLORS = Object.freeze({
  weddingJob: "#FF6A4D",
  preweddingJob: "#B69CFF",
  babyShowerJob: "#FF9AD5",
  weddingHighlight: "#8792AC",
  preweddingHighlight: "#2D6BE0",
  babyShowerHighlight: "#17A672",
  reels: "#17A672",
  shortFilm: "#FF6FB0",
});

const TICKET_STATUS_COLORS = Object.freeze({
  pending: "#CBD5E1",
  inProgress: "#3B82F6",
  completed: "#17A672",
  hold: "#F59E0B",
});

// IP access rules — "allow" switches the guard to allowlist mode, "block" always denies.
const IP_RULE_MODES = Object.freeze({
  allow: "allow",
  block: "block",
});

const IP_RULE_MODE_VALUES = Object.values(IP_RULE_MODES);

// Fine-grained permission registry (see ./permissions.js).
const {
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
} = require("./permissions");

module.exports = {
  ERole,
  ROLE_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_KEYS,
  TICKET_TYPE_LABELS,
  PRIORITY,
  PRIORITY_VALUES,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TICKET_STATUS,
  TICKET_STATUS_VALUES,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_COLORS,
  TICKET_STATUS_COLORS,
  IP_RULE_MODES,
  IP_RULE_MODE_VALUES,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
};
