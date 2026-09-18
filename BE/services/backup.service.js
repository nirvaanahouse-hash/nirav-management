const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getDriveClient, isConfigured, FOLDER_ID } = require("../config/google-drive");

function dumpDatabase() {
  return new Promise((resolve, reject) => {
    const archivePath = path.join(os.tmpdir(), `nirvaana-backup-${Date.now()}.gz`);
    execFile(
      "mongodump",
      ["--uri", process.env.MONGO_URI, "--archive", archivePath, "--gzip"],
      (error, _stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              error.code === "ENOENT"
                ? "mongodump isn't installed on this PC. Install MongoDB Database Tools, then restart the backend."
                : stderr || error.message,
            ),
          );
          return;
        }
        resolve(archivePath);
      },
    );
  });
}

async function uploadToDrive(archivePath) {
  const drive = getDriveClient();
  const response = await drive.files.create({
    requestBody: { name: path.basename(archivePath), parents: [FOLDER_ID] },
    media: { mimeType: "application/gzip", body: fs.createReadStream(archivePath) },
    fields: "id, name, webViewLink, size",
  });
  return response.data;
}

async function runFullBackup() {
  if (!isConfigured()) {
    throw new Error("Google Drive backup isn't set up yet — add the service account key and folder ID first.");
  }
  const archivePath = await dumpDatabase();
  try {
    return await uploadToDrive(archivePath);
  } finally {
    fs.unlink(archivePath, () => {});
  }
}

module.exports = { runFullBackup };
