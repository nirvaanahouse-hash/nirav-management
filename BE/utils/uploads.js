const fs = require("fs");
const path = require("path");
const { UPLOADS_ROOT } = require("../middleware/upload.middleware");

// Turn a stored value like "uploads/profile/x.png" into an absolute path on disk.
// Returns null for external URLs, legacy base64 data URLs, or anything that would
// escape the uploads folder (path-traversal guard).
function resolveUploadPath(stored) {
  if (!stored || /^(https?:\/\/|data:)/i.test(stored)) return null;
  const rel = String(stored).replace(/^\/+/, "").replace(/^uploads\//, "");
  const abs = path.resolve(UPLOADS_ROOT, rel);
  return abs === UPLOADS_ROOT || abs.startsWith(UPLOADS_ROOT + path.sep) ? abs : null;
}

function removeUploadedFile(stored) {
  const abs = resolveUploadPath(stored);
  if (abs) fs.promises.unlink(abs).catch(() => {});
}

module.exports = { resolveUploadPath, removeUploadedFile };
