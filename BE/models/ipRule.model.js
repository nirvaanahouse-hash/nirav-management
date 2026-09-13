const mongoose = require("mongoose");
const { IP_RULE_MODE_VALUES, IP_RULE_MODES } = require("../constants");

const ipRuleSchema = new mongoose.Schema(
  {
    // Exact IPv4/IPv6 address or an IPv4 CIDR block, e.g. "192.168.1.0/24".
    ip: {
      type: String,
      required: [true, "IP address is required"],
      unique: true,
      trim: true,
    },

    mode: {
      type: String,
      enum: IP_RULE_MODE_VALUES,
      default: IP_RULE_MODES.block,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 160,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // SA user id that created the rule.
    createdBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("IpRule", ipRuleSchema);
