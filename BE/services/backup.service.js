const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getDriveClient, FOLDER_ID } = require("../config/google-drive");

// A freshly-installed CLI tool's PATH entry doesn't reach an already-running
// PM2 daemon until it's next restarted from a login where the daemon itself
// picks up the new PATH (bit us the same way with `pm2 resurrect` earlier) —
// so check the standard MSI install location first instead of trusting PATH.
function resolveMongodumpPath() {
  const toolsDir = "C:\\Program Files\\MongoDB\\Tools";
  try {
    for (const version of fs.readdirSync(toolsDir)) {
      const candidate = path.join(toolsDir, version, "bin", "mongodump.exe");
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Tools dir doesn't exist yet — fall through to a plain PATH lookup.
  }
  return "mongodump";
}

function dumpDatabase() {
  return new Promise((resolve, reject) => {
    const archivePath = path.join(os.tmpdir(), `nirvaana-backup-${Date.now()}.gz`);
    execFile(
      resolveMongodumpPath(),
      // This build's arg parser rejects a space-separated `--uri <value>` as
      // an ambiguous positional argument (confirmed by hand) — `--flag=value`
      // is the form that actually works.
      [`--uri=${process.env.MONGO_URI}`, `--archive=${archivePath}`, "--gzip"],
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

module.exports = { dumpDatabase, uploadToDrive };
