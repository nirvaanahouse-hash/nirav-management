const fs = require("fs");
const { dumpDatabase } = require("../services/backup.service");

// Drive isn't wired up yet (needs a service account + folder set up on
// Google's side first — see BE/config/google-drive.js) — until then this
// just hands the admin the gzipped dump directly, so backups still work
// today and can be dragged into Drive by hand.
async function runBackup(req, res) {
  let archivePath;
  try {
    archivePath = await dumpDatabase();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Backup failed." });
    return;
  }

  const fileName = `nirvaana-backup-${new Date().toISOString().slice(0, 10)}.gz`;
  res.download(archivePath, fileName, (err) => {
    fs.unlink(archivePath, () => {});
    if (err && !res.headersSent) {
      res.status(500).json({ success: false, message: "Could not send the backup file." });
    }
  });
}

module.exports = { runBackup };
