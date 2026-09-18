const { runFullBackup } = require("../services/backup.service");

async function runBackup(req, res) {
  try {
    const file = await runFullBackup();
    res.json({
      success: true,
      message: "Backup uploaded to Google Drive.",
      data: { name: file.name, link: file.webViewLink, sizeBytes: Number(file.size) || undefined },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Backup failed." });
  }
}

module.exports = { runBackup };
