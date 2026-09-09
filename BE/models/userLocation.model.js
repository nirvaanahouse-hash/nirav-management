const mongoose = require("mongoose");

// One row per user — the last known browser location, upserted while the user
// is logged in and has location sharing on. Kept in its own tiny collection so
// the User document doesn't churn on every ping.
const UserLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    // Reported accuracy radius in metres, straight from the Geolocation API.
    accuracy: { type: Number, min: 0 },
    // The user's own toggle. When false we also clear the coords so a stale
    // position is never shown after they opt out.
    sharing: { type: Boolean, default: true },
  },
  { timestamps: true }, // updatedAt == last fix time
);

module.exports = mongoose.model("UserLocation", UserLocationSchema);
