const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const LoginEvent = require("../models/loginEvent.model");
const { ERole, DEFAULT_USER_PERMISSIONS } = require("../constants");
const { getClientIp } = require("../utils/ip");
const { effectivePermissions } = require("../utils/permissions");

// Fire-and-forget audit row for a login attempt — never blocks or fails the request.
const recordLoginEvent = (req, { user, emailTried, success, reason }) => {
  LoginEvent.create({
    userId: user ? String(user._id) : undefined,
    userName: user ? user.userName : undefined,
    email: user ? user.email : emailTried,
    role: user ? user.role : undefined,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"],
    success,
    reason,
  }).catch(() => {});
};

// Register User
const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      userName,
      email,
      password,
      mobileNumber,
    } = req.body;

    // Check Email
    const emailExists = await User.findOne({ email });

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
        errors: [{ field: "email", message: "Email already exists." }],
      });
    }

    // Check Username
    const usernameExists = await User.findOne({ userName });

    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
        errors: [{ field: "userName", message: "Username already exists." }],
      });
    }

    // Check Mobile Number
    const mobileExists = await User.findOne({ mobileNumber });

    if (mobileExists) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists",
        errors: [{ field: "mobileNumber", message: "Mobile number already exists." }],
      });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User — role is backend-controlled, never trust client
    const user = await User.create({
      firstName,
      lastName,
      userName,
      email,
      password: hashedPassword,
      plainPassword: password,
      mobileNumber,
      role: ERole.U,
      permissions: [...DEFAULT_USER_PERMISSIONS],
      isActive: true,
    });

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.plainPassword;

    res.status(201).json({
      success: true,
      message: "User Registered Successfully",
      data: userObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Login User
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user =
      (await User.findOne({ email })) ||
      (await User.findOne({ userName: email }));

    if (!user) {
      recordLoginEvent(req, { emailTried: email, success: false, reason: "User not found" });
      // Same status/message as a wrong password below — a distinct "user not
      // found" response lets an attacker enumerate valid usernames/emails by
      // scripting login attempts and watching which ones 404 vs 401.
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password.",
        errors: [{ field: "password", message: "Invalid email/username or password." }],
      });
    }

    // Block deactivated users
    if (!user.isActive) {
      recordLoginEvent(req, { user, success: false, reason: "Account deactivated" });
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      recordLoginEvent(req, { user, success: false, reason: "Invalid password" });
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password.",
        errors: [{ field: "password", message: "Invalid email/username or password." }],
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        isActive: user.isActive,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.plainPassword;
    // SA => full list; everyone else => their stored keys (never undefined).
    userObj.permissions = effectivePermissions(userObj);

    recordLoginEvent(req, { user, success: true, reason: "ok" });

    res.status(200).json({
      success: true,
      message: "Login Successfully",
      user: userObj,
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Logout User — Bearer-token auth is stateless (no server-side session/
// cookie to clear); the frontend just drops the token from sessionStorage.
// Kept as a real endpoint (rather than removed) for the login-event audit
// trail and so any future token-blacklist logic has a natural home.
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logout Successfully",
  });
};

module.exports = {
  register,
  login,
  logout,
};
