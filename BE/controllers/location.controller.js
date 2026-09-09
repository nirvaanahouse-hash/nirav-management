const UserLocation = require("../models/userLocation.model");
const User = require("../models/user.model");

const isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);

// GET /api/location/me — the caller's own sharing preference (so the UI toggle
// reflects the persisted state across devices).
const getMyLocationState = async (req, res) => {
  try {
    const doc = await UserLocation.findOne({ userId: req.user.id }).select("sharing").lean();
    return res.status(200).json({
      success: true,
      data: { sharing: doc ? doc.sharing !== false : true },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/location — the caller pushes their current position.
const updateMyLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body || {};

    if (!isFiniteNum(lat) || !isFiniteNum(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: "Valid lat/lng are required.",
        errors: [{ field: "lat", message: "Valid lat/lng are required." }],
      });
    }

    await UserLocation.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          lat,
          lng,
          accuracy: isFiniteNum(accuracy) && accuracy >= 0 ? accuracy : undefined,
          sharing: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(200).json({ success: true, message: "Location updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/location/sharing — flip the caller's sharing toggle. Turning it off
// also drops the stored coordinates.
const setSharing = async (req, res) => {
  try {
    const sharing = !!(req.body && req.body.sharing);

    const update = sharing
      ? { $set: { sharing: true } }
      : { $set: { sharing: false }, $unset: { lat: "", lng: "", accuracy: "" } };

    await UserLocation.findOneAndUpdate({ userId: req.user.id }, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    return res.status(200).json({ success: true, message: sharing ? "Sharing on" : "Sharing off", data: { sharing } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/location/:id — one user's last known location (SA / users.location).
const getUserLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("firstName lastName userName").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const doc = await UserLocation.findOne({ userId: id }).lean();

    const hasFix = doc && doc.sharing !== false && isFiniteNum(doc.lat) && isFiniteNum(doc.lng);

    return res.status(200).json({
      success: true,
      data: hasFix
        ? {
            userId: id,
            lat: doc.lat,
            lng: doc.lng,
            accuracy: doc.accuracy ?? null,
            updatedAt: doc.updatedAt,
            sharing: true,
          }
        : {
            userId: id,
            lat: null,
            lng: null,
            accuracy: null,
            updatedAt: doc ? doc.updatedAt : null,
            // Distinguish "opted out" from "never shared / no fix yet".
            sharing: doc ? doc.sharing !== false : true,
          },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyLocationState,
  updateMyLocation,
  setSharing,
  getUserLocation,
};
