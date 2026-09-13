const mongoose = require("mongoose");
const { ERole } = require("../constants");

const amountEntrySchema = new mongoose.Schema(
  {
    // Who this entry is about — either an employee or a client
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    recipientType: {
      type: String,
      enum: ["employee", "client"],
      required: true,
    },

    // Entry type: "received" (money coming in) or "sent" (money going out)
    type: {
      type: String,
      enum: ["received", "sent"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    // Optional reference to a ticket
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ticket",
      default: null,
    },

    // Id of whoever recorded the entry (an SA, or the user themselves)
    recordedBy: {
      type: String,
      required: true,
      trim: true,
    },

    // Role of whoever recorded the entry — lets both sides see who added what
    recordedByRole: {
      type: String,
      enum: [ERole.SA, ERole.A, ERole.U],
      trim: true,
    },

    // Display-name snapshot of whoever recorded the entry
    recordedByName: {
      type: String,
      trim: true,
    },

    // Description / note
    description: {
      type: String,
      trim: true,
    },

    // Date of the entry (defaults to now)
    entryDate: {
      type: Date,
      default: Date.now,
    },

    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("AmountEntry", amountEntrySchema);
