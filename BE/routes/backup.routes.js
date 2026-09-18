const express = require("express");
const router = express.Router();
const { requireSA } = require("../middleware/role.middleware");
const { handleRestoreUpload } = require("../middleware/upload.middleware");
const { runBackup, restoreBackup } = require("../controllers/backup.controller");

// Full DB export/import — the most data-exfiltration- and data-loss-shaped
// operations in the app, so both are SA-only, same as financial-reveal.
router.post("/backup/run", requireSA, runBackup);
router.post("/backup/restore", requireSA, handleRestoreUpload, restoreBackup);

module.exports = router;
