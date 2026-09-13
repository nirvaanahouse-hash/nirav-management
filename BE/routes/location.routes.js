const express = require("express");
const router = express.Router();
const { requirePermission } = require("../middleware/permission.middleware");
const { mongoIdParam } = require("../middleware/validate.middleware");
const {
  getMyLocationState,
  updateMyLocation,
  setSharing,
  getUserLocation,
} = require("../controllers/location.controller");

// Every authenticated user manages their own location share.
router.get("/location/me", getMyLocationState);
router.put("/location", updateMyLocation);
router.put("/location/sharing", setSharing);

// SA / delegated: view another user's last known location.
router.get("/location/:id", mongoIdParam, requirePermission("users.location"), getUserLocation);

module.exports = router;
