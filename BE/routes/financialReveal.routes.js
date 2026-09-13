const express = require("express");
const router = express.Router();
const { requireSA } = require("../middleware/role.middleware");
const { requestReveal, verifyReveal } = require("../controllers/financialReveal.controller");

// SA-only — this exists specifically to gate the SA's own view of financial
// figures, so there is no scenario where anyone else should call it.
router.post("/financial-reveal/request", requireSA, requestReveal);
router.post("/financial-reveal/verify", requireSA, verifyReveal);

module.exports = router;
