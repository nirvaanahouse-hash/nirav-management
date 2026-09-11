// Shared Constants & Enums between FE and BE

/**
 * Ticket types are managed by the SA at /sa/ticket-types and reach the app
 * through TicketMetaService. These built-in maps are only the fallback used
 * to render a type that has since been removed from the registry.
 */
export const TICKET_TYPES = {
  weddingJob: "Wedding JOB",
  preweddingJob: "Prewedding JOB",
  babyShowerJob: "Baby Shower JOB",
  weddingHighlight: "Wedding HighLight",
  preweddingHighlight: "Prewedding HighLight",
  babyShowerHighlight: "Baby Shower HighLight",
  reels: "Reels",
  shortFilm: "Short Film",
} as const;

export const PRIORITY = {
  low: "low",
  medium: "medium",
  high: "high",
} as const;

export type Priority = keyof typeof PRIORITY;

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

/**
 * Semantic badge variants. Colors live in the theme tokens
 * (`.badge--<variant>` in styles.scss), never as literals in TS/HTML.
 */
export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

export const PRIORITY_VARIANT: Record<Priority, BadgeVariant> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

/** Fallback badge variants for the built-in types (see TICKET_TYPES above). */
export const TICKET_TYPE_VARIANT: Record<string, BadgeVariant> = {
  weddingJob: "accent",
  preweddingJob: "accent",
  babyShowerJob: "accent",
  weddingHighlight: "info",
  preweddingHighlight: "info",
  babyShowerHighlight: "info",
  reels: "success",
  shortFilm: "success",
};

/** Pickable badge colours — mirrors BADGE_VARIANTS in BE/constants/index.js. */
export const BADGE_VARIANT_OPTIONS: { value: BadgeVariant; label: string }[] = [
  { value: "neutral", label: "Grey" },
  { value: "accent", label: "Orange" },
  { value: "info", label: "Blue" },
  { value: "success", label: "Green" },
  { value: "warning", label: "Amber" },
  { value: "danger", label: "Red" },
];

export const TICKET_STATUS = {
  pending: "pending",
  inProgress: "inProgress",
  completed: "completed",
  hold: "hold",
} as const;

export type TicketStatus = keyof typeof TICKET_STATUS;

export const TICKET_STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "inProgress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "hold", label: "Hold" },
];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "Pending",
  inProgress: "In Progress",
  completed: "Completed",
  hold: "Hold",
};

export const TICKET_STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  pending: "neutral",
  inProgress: "info",
  completed: "success",
  hold: "warning",
};

export const ROLES = {
  SA: "SA",
  A: "A",
  U: "U",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  SA: "Super Admin",
  A: "Admin",
  U: "Employee",
};

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "SA", label: "Super Admin" },
  { value: "A", label: "Admin" },
  { value: "U", label: "Employee" },
];

// --- IP & Security ---
export type IpRuleMode = "allow" | "block";

export const IP_RULE_MODE_OPTIONS: { value: IpRuleMode; label: string }[] = [
  { value: "block", label: "Block" },
  { value: "allow", label: "Allow" },
];

export const IP_RULE_MODE_VARIANT: Record<IpRuleMode, BadgeVariant> = {
  allow: "success",
  block: "danger",
};

