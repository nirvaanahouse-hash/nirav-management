const mongoose = require("mongoose");
const { BADGE_VARIANTS } = require("../constants");

/**
 * SA-managed ticket types (UI at /sa/ticket-types). Replaces the old hard-coded
 * TICKET_TYPES constant — the constant now only seeds this collection once.
 *
 * `key` is what every ticket stores in `ticketType`. It is derived from the
 * label when the type is created and never changes afterwards, so renaming a
 * type leaves existing tickets intact.
 *
 * `isJob` marks the hour-wise ("JOB") types, which are priced HR × hrPrice
 * instead of a flat amount. The whole codebase detects that with a trailing
 * "Job" on the key, so the key and this flag are kept in step at create time
 * (see utils/ticket-types.js `buildTicketTypeKey`) and neither can be edited
 * later.
 */
const ticketTypeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    // Semantic badge variant — colours stay in the theme tokens, never a hex here.
    variant: {
      type: String,
      enum: BADGE_VARIANTS,
      default: "neutral",
    },

    // Hour-wise pricing (HR × HR price) instead of a flat amount.
    isJob: {
      type: Boolean,
      default: false,
    },

    // Inactive types stay on old tickets but drop out of the ticket form.
    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("TicketType", ticketTypeSchema);
