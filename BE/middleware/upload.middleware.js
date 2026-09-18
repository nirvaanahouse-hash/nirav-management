const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");

// Uploaded profile photos live on disk (not in Mongo) so the DB stays small.
// NOTE: on hosts with an ephemeral filesystem (e.g. Render without a persistent
// disk) these files are wiped on every redeploy — mount a persistent disk in prod.
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const PROFILE_DIR = path.join(UPLOADS_ROOT, "profile");
const CLIENT_DIR = path.join(UPLOADS_ROOT, "client");
fs.mkdirSync(PROFILE_DIR, { recursive: true });
fs.mkdirSync(CLIENT_DIR, { recursive: true });

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_IMAGE_BYTES = 10 * 1024; // 10 KB

// Keep the image in whatever format it was uploaded in — just map to a safe extension.
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

function fileFilter(req, file, cb) {
  // SVG is excluded even though it's "image/*" — it's XML and can embed
  // <script>, and /uploads is served publicly (before authMiddleware) with no
  // Content-Security-Policy, so an uploaded SVG opened directly in a browser
  // tab would execute as stored XSS on this origin.
  if (file.mimetype === "image/svg+xml") {
    return cb(new Error("SVG images aren't allowed."));
  }
  if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
  cb(new Error("Only image files are allowed."));
}

/**
 * Single-image upload middleware for a given folder. `nameFor(req)` supplies
 * the filename stem (the owning user or record id) so replacing a photo never
 * collides with another one.
 */
function createImageUpload(dir, nameFor) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const fromName = path.extname(file.originalname || "").toLowerCase();
      const ext = EXT_BY_MIME[file.mimetype] || fromName || "";
      cb(null, `${nameFor(req)}-${Date.now()}${ext}`);
    },
  });

  const runUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  }).single("image");

  // Wrap multer so its errors come back in the app's standard JSON error shape.
  return function handleImageUpload(req, res, next) {
    runUpload(req, res, (err) => {
      if (err) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? "Image too large. Please choose an image up to 10 MB."
            : err.message || "Upload failed.";
        return res
          .status(400)
          .json({ success: false, message, errors: [{ field: "image", message }] });
      }

      // multer has no built-in minimum — reject too-small files (junk/corrupt
      // uploads) here, after the file is already on disk.
      if (req.file && req.file.size < MIN_IMAGE_BYTES) {
        fs.unlink(req.file.path, () => {});
        const message = "Image too small. Please choose an image of at least 10 KB.";
        return res
          .status(400)
          .json({ success: false, message, errors: [{ field: "image", message }] });
      }

      return next();
    });
  };
}

const handleProfileImageUpload = createImageUpload(PROFILE_DIR, (req) => req.user.id);
const handleClientImageUpload = createImageUpload(CLIENT_DIR, (req) => req.params.id);

// A restore archive is transient (deleted right after mongorestore runs), so
// it lives in the OS temp dir rather than the permanent /uploads tree.
const MAX_RESTORE_BYTES = 200 * 1024 * 1024; // 200 MB

const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `nirvaana-restore-${Date.now()}.gz`),
  }),
  fileFilter: (req, file, cb) => {
    if (!/\.gz$/i.test(file.originalname || "")) {
      return cb(new Error("Only a .gz backup archive can be restored."));
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_RESTORE_BYTES, files: 1 },
}).single("backup");

function handleRestoreUpload(req, res, next) {
  restoreUpload(req, res, (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "Backup file too large (max 200 MB)." : err.message || "Upload failed.";
      return res.status(400).json({ success: false, message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No backup file was sent." });
    }
    return next();
  });
}

module.exports = {
  handleProfileImageUpload,
  handleClientImageUpload,
  handleRestoreUpload,
  UPLOADS_ROOT,
  PROFILE_DIR,
  CLIENT_DIR,
  MAX_IMAGE_BYTES,
  MIN_IMAGE_BYTES,
};
