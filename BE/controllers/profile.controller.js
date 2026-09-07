const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const { ERole } = require("../constants");

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
    const { image, gender, homeAddress, dob, percentage } = req.body;

    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...(image !== undefined ? { image } : {}),
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
      image,
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
          ...(image !== undefined ? { image } : {}),
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

module.exports = { getProfile, postProfile, updateProfile };
