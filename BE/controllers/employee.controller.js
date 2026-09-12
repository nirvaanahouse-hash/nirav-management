const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const Ticket = require("../models/ticket.model");
const AmountEntry = require("../models/amountEntry.model");
const { calculateTicketFinancials } = require("../utils/ticket-financials");
const { ERole, DEFAULT_USER_PERMISSIONS } = require("../constants");

// POST /api/employees — SA creating an employee directly (distinct from the
// public self-registration flow in auth.controller.js, which this mirrors).
const createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, userName, email, password, mobileNumber } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
        errors: [{ field: "email", message: "Email already exists." }],
      });
    }
    if (await User.findOne({ userName })) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
        errors: [{ field: "userName", message: "Username already exists." }],
      });
    }
    if (mobileNumber && (await User.findOne({ mobileNumber }))) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists",
        errors: [{ field: "mobileNumber", message: "Mobile number already exists." }],
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
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

    return res.status(201).json({
      success: true,
      message: "Employee created",
      data: userObj,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/employees/:id — refuses if the employee has any ticket or
// amount-entry history, the same "turn it off instead" convention already
// used for ticket types (see ticketType.controller.js deleteTicketType):
// this app has no cascading hard-delete anywhere, and an employee with real
// history is exactly the case that would corrupt reporting if removed.
const deleteEmployee = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: ERole.U });
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const [ticketCount, entryCount] = await Promise.all([
      Ticket.countDocuments({ $or: [{ assignedEmployee: req.params.id }, { createdBy: req.params.id }] }),
      AmountEntry.countDocuments({ recipient: req.params.id, recipientType: "employee" }),
    ]);
    if (ticketCount > 0 || entryCount > 0) {
      return res.status(409).json({
        success: false,
        message: `${user.firstName} ${user.lastName} has ${ticketCount} ticket(s) and ${entryCount} amount entr${entryCount === 1 ? "y" : "ies"} on record. Deactivate them instead so that history stays intact.`,
      });
    }

    await Promise.all([User.deleteOne({ _id: req.params.id }), Profile.deleteOne({ userId: req.params.id })]);

    return res.status(200).json({
      success: true,
      message: "Employee deleted",
      data: { _id: req.params.id },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get employee counts
const getEmployeeStats = async (req, res) => {
  try {
    const total = await User.countDocuments({ role: ERole.U });
    const active = await User.countDocuments({ role: ERole.U, isActive: true });
    const inactive = await User.countDocuments({ role: ERole.U, isActive: false });

    return res.status(200).json({
      success: true,
      data: {
        totalEmployees: total,
        activeEmployees: active,
        inactiveEmployees: inactive,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all users (for ticket select dropdowns)
const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { userName: regex },
        { email: regex },
      ];
    }
    // This list only feeds select dropdowns — expose the display fields only,
    // never email / mobile / timestamps of every user to every role.
    const users = await User.find(filter)
      .select("_id firstName lastName userName role isActive")
      .sort({ firstName: 1, lastName: 1 })
      .lean();
    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// List all employees (admin only)
const getEmployees = async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;

    const filter = { role: ERole.U };

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { userName: regex },
        { email: regex },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const employees = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(filter);

    const ids = employees.map((e) => String(e._id));

    const [profiles, tickets, entries] = await Promise.all([
      Profile.find({ userId: { $in: ids } }).select("userId percentage").lean(),
      // Only completed + finalised work is actually owed to the user.
      Ticket.find({
        assignedEmployee: { $in: ids },
        status: "completed",
        isFinalized: true,
      })
        .select("assignedEmployee amount mainAmount userPersentage HR mainHr hrPrice ticketType")
        .lean(),
      AmountEntry.find({ recipient: { $in: ids }, recipientType: "employee", isActive: true })
        .select("recipient amount type")
        .lean(),
    ]);

    const pctByUser = {};
    profiles.forEach((p) => {
      pctByUser[String(p.userId)] = Number(p.percentage || 0);
    });

    // Total the studio owes each user = earnings on their finalised tickets
    // − net already paid.
    const earnedByUser = {};
    tickets.forEach((t) => {
      const uid = String(t.assignedEmployee);
      earnedByUser[uid] = (earnedByUser[uid] || 0) + calculateTicketFinancials(t).employeeEarnings;
    });
    const paidByUser = {};
    entries.forEach((e) => {
      const uid = String(e.recipient);
      const delta = e.type === "sent" ? Number(e.amount || 0) : -Number(e.amount || 0);
      paidByUser[uid] = (paidByUser[uid] || 0) + delta;
    });

    const withMeta = employees.map((e) => {
      const uid = String(e._id);
      const earned = earnedByUser[uid] || 0;
      const paid = paidByUser[uid] || 0;
      return {
        ...e,
        percentage: pctByUser[uid] || 0,
        totalEarned: Math.round(earned),
        totalPaid: Math.round(paid),
        balanceDue: Math.round(earned - paid),
      };
    });

    return res.status(200).json({
      success: true,
      data: withMeta,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single employee
const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findOne({
      _id: req.params.id,
      role: ERole.U,
    })
      .select("-password -plainPassword")
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Merge the profile-only fields so the edit form can pre-fill everything.
    const profile = await Profile.findOne({ userId: req.params.id })
      .select("homeAddress gender dob percentage image")
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...employee,
        homeAddress: profile?.homeAddress ?? "",
        gender: profile?.gender ?? "",
        dob: profile?.dob ?? "",
        percentage: profile?.percentage ?? 0,
        image: profile?.image ?? "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update a user's full details — User doc + Profile doc (SA only).
// Every field is required, including the profit-share percentage.
const updateEmployeeDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      userName,
      email,
      mobileNumber,
      role,
      homeAddress,
      gender,
      dob,
      percentage,
    } = req.body;

    const requiredText = {
      firstName,
      lastName,
      userName,
      email,
      mobileNumber,
      homeAddress,
      gender,
      dob,
    };
    const missing = Object.entries(requiredText)
      .filter(([, v]) => v === undefined || v === null || String(v).trim() === "")
      .map(([k]) => k);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Please fill in: ${missing.join(", ")}`,
        errors: missing.map((f) => ({ field: f, message: "This field is required." })),
      });
    }

    const pct = Number(percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({
        success: false,
        message: "Profit share must be a number between 0 and 100.",
        errors: [{ field: "percentage", message: "Required — a number between 0 and 100." }],
      });
    }

    const user = await User.findOne({ _id: id, role: ERole.U });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Reject collisions with a different user's login identifiers.
    const clash = await User.findOne({
      _id: { $ne: id },
      $or: [
        { userName: String(userName).toLowerCase() },
        { email: String(email).toLowerCase() },
        { mobileNumber: String(mobileNumber) },
      ],
    })
      .select("userName email mobileNumber")
      .lean();
    if (clash) {
      const field =
        clash.userName === String(userName).toLowerCase()
          ? "userName"
          : clash.email === String(email).toLowerCase()
            ? "email"
            : "mobileNumber";
      return res.status(409).json({
        success: false,
        message: `Another user already uses that ${field}.`,
        errors: [{ field, message: "Already in use by another user." }],
      });
    }

    user.firstName = String(firstName).trim();
    user.lastName = String(lastName).trim();
    user.userName = String(userName).trim().toLowerCase();
    user.email = String(email).trim().toLowerCase();
    user.mobileNumber = String(mobileNumber).trim();
    if (role && [ERole.U, ERole.A, ERole.SA].includes(role)) user.role = role;
    await user.save(); // runs schema validators (minlength, etc.)

    await Profile.findOneAndUpdate(
      { userId: id },
      { $set: { homeAddress: String(homeAddress).trim(), gender, dob, percentage: pct } },
      { new: true, upsert: true },
    );

    const obj = user.toObject();
    delete obj.password;
    delete obj.plainPassword;

    return res.status(200).json({
      success: true,
      message: "User details updated",
      data: { ...obj, homeAddress: String(homeAddress).trim(), gender, dob, percentage: pct },
    });
  } catch (error) {
    if (error && error.code === 11000) {
      const field = Object.keys(error.keyPattern || { field: 1 })[0];
      return res.status(409).json({
        success: false,
        message: `Another user already uses that ${field}.`,
        errors: [{ field, message: "Already in use by another user." }],
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Activate/deactivate employee
const updateEmployeeStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, role: ERole.U },
      { $set: { isActive } },
      { new: true }
    ).select("-password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Employee ${isActive ? "activated" : "deactivated"} successfully`,
      data: employee,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Set / reset an employee's password (SA only)
const updateEmployeePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
        errors: [{ field: "password", message: "Password must be at least 6 characters." }],
      });
    }

    const employee = await User.findOne({ _id: req.params.id, role: ERole.U });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    employee.password = await bcrypt.hash(String(password), 10);
    employee.plainPassword = String(password);
    await employee.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Set a user's profit-share percentage (SA only). Stored on the Profile doc.
const updateEmployeePercentage = async (req, res) => {
  try {
    const pct = Number(req.body.percentage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage must be between 0 and 100.",
        errors: [{ field: "percentage", message: "Percentage must be between 0 and 100." }],
      });
    }

    const user = await User.findOne({ _id: req.params.id, role: ERole.U });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await Profile.findOneAndUpdate(
      { userId: req.params.id },
      { $set: { percentage: pct } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Percentage updated",
      data: { _id: req.params.id, percentage: pct },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getEmployeeStats,
  getAllUsers,
  getEmployees,
  getEmployeeById,
  createEmployee,
  deleteEmployee,
  updateEmployeeDetails,
  updateEmployeeStatus,
  updateEmployeePassword,
  updateEmployeePercentage,
};
