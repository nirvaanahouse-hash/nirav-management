const fs = require("fs");
const { dumpDatabase, uploadToDrive, restoreDatabase } = require("../services/backup.service");
const { isConfigured } = require("../config/google-drive");

async function runBackup(req, res) {
  let archivePath;
  try {
    archivePath = await dumpDatabase();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Backup failed." });
    return;
  }

  // Best-effort — a failed/unset-up Drive upload should never block the
  // admin from still getting their download. X-Drive-Status tells the
  // frontend which happened, since the response body is the file itself.
  if (isConfigured()) {
    try {
      await uploadToDrive(archivePath);
      res.set("X-Drive-Status", "uploaded");
    } catch (error) {
      res.set("X-Drive-Status", `failed: ${String(error.message || error).slice(0, 200).replace(/[\r\n]+/g, " ")}`);
    }
  } else {
    res.set("X-Drive-Status", "not-configured");
  }

  const fileName = `nirvaana-backup-${new Date().toISOString().slice(0, 10)}.gz`;
  res.download(archivePath, fileName, (err) => {
    fs.unlink(archivePath, () => {});
    if (err && !res.headersSent) {
      res.status(500).json({ success: false, message: "Could not send the backup file." });
    }
  });
}

async function restoreBackup(req, res) {
  const archivePath = req.file.path;
  try {
    const { restoredCount, skippedCount } = await restoreDatabase(archivePath);
    res.json({
      success: true,
      message:
        skippedCount > 0
          ? `Restored ${restoredCount} new document(s). ${skippedCount} already existed and were left unchanged.`
          : `Restored ${restoredCount} new document(s).`,
      data: { restoredCount, skippedCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Restore failed." });
  } finally {
    fs.unlink(archivePath, () => {});
  }
}

module.exports = { runBackup, restoreBackup };
