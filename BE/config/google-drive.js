const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// Service-account auth — no browser/consent flow, so it works headless from
// a backend job. The key file itself is a credential and stays out of git
// (see .gitignore); share the target Drive folder with the service
// account's own @...iam.gserviceaccount.com email to grant it access.
const KEY_PATH = process.env.GOOGLE_DRIVE_KEY_PATH || path.join(__dirname, "google-drive-key.json");
const FOLDER_ID = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || "";

function isConfigured() {
  return fs.existsSync(KEY_PATH) && !!FOLDER_ID;
}

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    // drive.file — only touches files this app itself created, not the
    // account's whole Drive.
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

module.exports = { getDriveClient, isConfigured, FOLDER_ID, KEY_PATH };
