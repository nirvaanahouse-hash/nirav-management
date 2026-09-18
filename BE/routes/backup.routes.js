const express = require("express");
const router = express.Router();
const { requireSA } = require("../middleware/role.middleware");
const { runBackup } = require("../controllers/backup.controller");

// Full DB export — the most data-exfiltration-shaped operation in the app,
// so it's SA-only, same as financial-reveal.
router.post("/backup/run", requireSA, runBackup);

module.exports = router;
