const mongoose = require("mongoose");
const { ERole } = require("../constants");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },

    userName: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },

    // Plain copy kept so the SA can look up a user's login on the Users page.
    // Internal studio tool — not a public product.
    plainPassword: {
      type: String,
      trim: true,
    },

    mobileNumber: {
      type: String,
      required: [true, "Mobile Number is required"],
      unique: true,
      trim: true,
      minlength: 10,
      maxlength: 10,
    },

    role: {
      type: String,
      enum: [ERole.U, ERole.A, ERole.SA],
      default: ERole.U,
    },

    // Fine-grained permission keys (see constants/permissions.js). Left
    // `undefined` on legacy docs so the boot backfill can detect + seed them.
    // The SA is never checked against this list.
    permissions: {
      type: [String],
      default: undefined,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
