const fs = require("fs");
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Keep the image in whatever format it was uploaded in — just map to a safe extension.
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

function fileFilter(req, file, cb) {
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
      if (!err) return next();
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image too large. Please choose an image up to 5 MB."
          : err.message || "Upload failed.";
      return res
        .status(400)
        .json({ success: false, message, errors: [{ field: "image", message }] });
    });
  };
}

const handleProfileImageUpload = createImageUpload(PROFILE_DIR, (req) => req.user.id);
const handleClientImageUpload = createImageUpload(CLIENT_DIR, (req) => req.params.id);

module.exports = {
  handleProfileImageUpload,
  handleClientImageUpload,
  UPLOADS_ROOT,
  PROFILE_DIR,
  CLIENT_DIR,
  MAX_IMAGE_BYTES,
};
