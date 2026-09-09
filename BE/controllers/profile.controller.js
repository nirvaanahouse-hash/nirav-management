const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const { ERole } = require("../constants");
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

// Get Profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-password -plainPassword").lean();
    const profile = await Profile.findOne({ userId }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const response = {
      ...user,
      ...(profile ? profile : {}),
    };

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Post Profile (create or update profile-specific fields)
const postProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    // `image` is intentionally not accepted here — the photo is managed via the
    // dedicated /profile/image upload endpoints and stored on disk, not in Mongo.
    const { gender, homeAddress, dob, percentage } = req.body;

    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(gender !== undefined ? { gender } : {}),
          ...(homeAddress !== undefined ? { homeAddress } : {}),
          ...(dob !== undefined ? { dob } : {}),
          ...(percentage !== undefined ? { percentage } : {}),
        },
      },
      { new: true, upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: "Profile updated successfully",
      data: profile,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update User profile fields
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      mobileNumber,
      email,
      userName,
      role,
      password,
      gender,
      homeAddress,
      dob,
      percentage,
    } = req.body;

    // Role is backend-controlled — ignore client-provided role unless requester is SA
    const isSA = req.user.role === ERole.SA;

    if (password !== undefined && String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
        errors: [{ field: "password", message: "Password must be at least 6 characters." }],
      });
    }

    const userUpdates = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(mobileNumber !== undefined ? { mobileNumber } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(userName !== undefined ? { userName } : {}),
      ...((role !== undefined && isSA) ? { role } : {}),
      ...(password
        ? { password: await bcrypt.hash(String(password), 10), plainPassword: String(password) }
        : {}),
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: userUpdates },
      { new: true, runValidators: true }
    ).select("-password -plainPassword");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(gender !== undefined ? { gender } : {}),
          ...(homeAddress !== undefined ? { homeAddress } : {}),
          ...(dob !== undefined ? { dob } : {}),
          ...(percentage !== undefined ? { percentage } : {}),
        },
      },
      { new: true, upsert: true }
    );

    const userObj = updatedUser.toObject();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: userObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload / replace the current user's profile photo.
// The file is already on disk (multer) by the time we get here — we just record
// its relative path and clean up the previous one.
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded." });
    }

    const userId = req.user.id;
    const relPath = `uploads/profile/${req.file.filename}`;

    const prev = await Profile.findOne({ userId }).select("image").lean();

    const saved = await Profile.findOneAndUpdate(
      { userId },
      { $set: { image: relPath } },
      { new: true, upsert: true }
    );

    if (prev && prev.image && prev.image !== relPath) {
      removeUploadedFile(prev.image);
    }

    return res.status(200).json({
      success: true,
      message: "Photo updated successfully",
      data: { image: saved.image },
    });
  } catch (error) {
    // DB write failed — don't leave the just-uploaded file orphaned on disk.
    if (req.file && req.file.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Remove the current user's profile photo (clears the field and deletes the file).
const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;

    const prev = await Profile.findOne({ userId }).select("image").lean();

    await Profile.findOneAndUpdate(
      { userId },
      { $set: { image: "" } },
      { new: true, upsert: true }
    );

    if (prev && prev.image) removeUploadedFile(prev.image);

    return res.status(200).json({
      success: true,
      message: "Photo removed",
      data: { image: "" },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProfile,
  postProfile,
  updateProfile,
  uploadProfileImage,
  deleteProfileImage,
};
