const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { getDriveClient, FOLDER_ID } = require("../config/google-drive");

// A freshly-installed CLI tool's PATH entry doesn't reach an already-running
// PM2 daemon until it's next restarted from a login where the daemon itself
// picks up the new PATH (bit us the same way with `pm2 resurrect` earlier) —
// so check the standard MSI install location first instead of trusting PATH.
function resolveMongoToolPath(exeName) {
  const toolsDir = "C:\\Program Files\\MongoDB\\Tools";
  try {
    for (const version of fs.readdirSync(toolsDir)) {
      const candidate = path.join(toolsDir, version, "bin", exeName);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Tools dir doesn't exist yet — fall through to a plain PATH lookup.
  }
  return exeName.replace(/\.exe$/, "");
}

function missingToolMessage(toolName) {
  return `${toolName} isn't installed on this PC. Install MongoDB Database Tools, then restart the backend.`;
}

function dumpDatabase() {
  return new Promise((resolve, reject) => {
    const archivePath = path.join(os.tmpdir(), `nirvaana-backup-${Date.now()}.gz`);
    execFile(
      resolveMongoToolPath("mongodump.exe"),
      // This build's arg parser rejects a space-separated `--uri <value>` as
      // an ambiguous positional argument (confirmed by hand) — `--flag=value`
      // is the form that actually works.
      [`--uri=${process.env.MONGO_URI}`, `--archive=${archivePath}`, "--gzip"],
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(error.code === "ENOENT" ? missingToolMessage("mongodump") : stderr || error.message));
          return;
        }
        resolve(archivePath);
      },
    );
  });
}

// No --drop: an existing document whose _id matches one in the archive is
// left untouched (mongorestore reports it as a failed insert — duplicate
// key — and moves on) rather than being overwritten by the older backup.
// Confirmed by hand: only genuinely new documents get inserted.
function restoreDatabase(archivePath) {
  return new Promise((resolve, reject) => {
    execFile(
      resolveMongoToolPath("mongorestore.exe"),
      [`--uri=${process.env.MONGO_URI}`, `--archive=${archivePath}`, "--gzip"],
      (error, _stdout, stderr) => {
        if (error && error.code === "ENOENT") {
          reject(new Error(missingToolMessage("mongorestore")));
          return;
        }
        // A restore with some duplicate-key skips exits non-zero even though
        // it did exactly what it should — parse the summary line instead of
        // treating that as a hard failure.
        const summary = /(\d+) document\(s\) restored successfully\.\s*(\d+) document\(s\) failed to restore\./.exec(
          stderr || "",
        );
        if (!summary) {
          reject(new Error(stderr || (error && error.message) || "Restore failed."));
          return;
        }
        resolve({ restoredCount: Number(summary[1]), skippedCount: Number(summary[2]) });
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

module.exports = { dumpDatabase, uploadToDrive, restoreDatabase };
