const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middleware/role.middleware");
const { runBackup } = require("../controllers/backup.controller");

// Full DB export + Google Drive upload — a data-exfiltration-shaped
// operation, so it's gated the same as the other admin-only routes.
router.post("/backup/run", requireAdmin, runBackup);

module.exports = router;
