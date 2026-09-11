const mongoose = require("mongoose");
const { PRIORITY, TICKET_STATUS } = require("../constants");

const ticketSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },

    createdBy: {
      type: String,
      required: true,
      trim: true,
    },

    // Denormalized snapshot of the creator's name, set from the auth session.
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },

    assignedEmployee: {
      type: String,
      trim: true,
      default: null,
    },

    client: {
      type: String,
      trim: true,
      default: null,
    },

    coupleName: {
      type: String,
      required: true,
      trim: true,
    },

    // The `key` of a TicketType. Not an enum — the SA manages that list at
    // /sa/ticket-types, and the value is checked against the live registry in
    // middleware/ticketType.middleware.js. Old tickets keep their key even if
    // the type is later switched off.
    ticketType: {
      type: String,
      required: true,
      trim: true,
    },

    HR: {
      type: String,
      trim: true,
    },

    mainHr: {
      type: String,
      trim: true,
    },

    priorety: {
      type: String,
      enum: Object.values(PRIORITY),
      trim: true,
      default: PRIORITY.medium,
    },

    amount: {
      type: String,
      trim: true,
    },

    mainAmount: {
      type: String,
      trim: true,
    },

    deleveryDate: {
      type: String,
      trim: true,
    },

    userPersentage: {
      type: String,
      trim: true,
    },

    // Hour-wise price for job-type tickets (SA enters this)
    hrPrice: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: Object.values(TICKET_STATUS),
      default: TICKET_STATUS.pending,
    },

    remark: {
      type: String,
      trim: true,
      default: "",
    },

    isFinalized: {
      type: Boolean,
      default: false,
    },

    // Billing: true once this ticket has been included in a downloaded
    // client invoice PDF ("Current" billing run). Keeps the next run from
    // re-billing work that has already been invoiced.
    isPdf: {
      type: Boolean,
      default: false,
    },

    finalizedBy: {
      type: String,
      trim: true,
      default: null,
    },

    finalizedAt: {
      type: Date,
      default: null,
    },
 
    comments: [
      {
        userId: { type: String, required: true, trim: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ticket", ticketSchema);
