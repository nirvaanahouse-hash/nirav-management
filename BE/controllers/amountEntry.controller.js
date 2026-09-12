const AmountEntry = require("../models/amountEntry.model");
const User = require("../models/user.model");
const Client = require("../models/client.model");
const Ticket = require("../models/ticket.model");
const { createNotification } = require("../services/notification.service");
const { calculateTicketFinancials } = require("../utils/ticket-financials");
const { hasPermission } = require("../utils/permissions");

// List amount entries (SA sees all, employee sees only their own)
const getAmountEntries = async (req, res) => {
  try {
    const { user } = req;
    // SA, or anyone granted the studio-wide ledger view, may query any recipient.
    const isSuperAdmin = hasPermission(user, "amounts.summary.sa");

    let filter = { isActive: true };

    if (isSuperAdmin) {
      // Only the SA may filter by an arbitrary recipient.
      if (req.query.recipient) filter.recipient = req.query.recipient;
      if (req.query.recipientType) filter.recipientType = req.query.recipientType;
    } else {
      // Everyone else is locked to their own employee ledger — a ?recipient
      // override in the query is ignored.
      filter.recipient = user.id;
      filter.recipientType = "employee";
    }

    const entries = await AmountEntry.find(filter).sort({ createdAt: -1 }).lean();

    // Resolve the recorder's display name from the linked id every read, so a
    // rename anywhere is reflected here (the stored name is only a fallback).
    const recorderIds = [...new Set(entries.map((e) => e.recordedBy).filter(Boolean))];
    const recorders = await User.find({ _id: { $in: recorderIds } })
      .select("firstName lastName userName")
      .lean();
    const recorderMap = {};
    recorders.forEach((u) => {
      recorderMap[String(u._id)] =
        `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.userName || "";
    });

    const data = entries.map((e) => ({
      ...e,
      recordedByName: recorderMap[String(e.recordedBy)] || e.recordedByName || "",
    }));

    return res.status(200).json({
      success: true,
      message: "Amount entries fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create amount entry — SA for anyone; a user only for their own account
const createAmountEntry = async (req, res) => {
  try {
    const { user } = req;
    const { recipient, recipientType, type, amount, ticketId, description } = req.body;

    const isSA = user.role === "SA";

    // Non-SA users may only record entries about their own employee ledger.
    if (!isSA) {
      if (recipientType !== "employee" || String(recipient) !== String(user.id)) {
        return res.status(403).json({
          success: false,
          message: "You can only record amount entries for your own account.",
        });
      }
    }

    const recordedByName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.userName ||
      "User";

    const entry = await AmountEntry.create({
      recipient,
      recipientType,
      type,
      amount: Number(amount),
      ticketId: ticketId || null,
      recordedBy: user.id,
      recordedByRole: user.role,
      recordedByName,
      description: description || "",
    });

    // When an SA sends money to an employee, notify that employee.
    if (isSA && recipientType === "employee" && type === "sent") {
      let recipientName = "Employee";
      try {
        const recipientUser = await User.findById(recipient).lean();
        if (recipientUser) {
          recipientName = `${recipientUser.firstName} ${recipientUser.lastName}`;
        }
      } catch (e) {
        // ignore
      }

      await createNotification({
        recipient: recipient,
        type: "AMOUNT_SENT",
        title: "Payment Received",
        message: `${user.firstName || user.userName || "SA"} has sent you ₹${Number(amount).toLocaleString()}`,
        ticketId: ticketId || null,
        actorId: user.id,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Amount entry created successfully",
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /api/amount-entries/:id
const getAmountEntryById = async (req, res) => {
  try {
    const { user } = req;
    const entry = await AmountEntry.findById(req.params.id).lean();
    if (!entry || !entry.isActive) {
      return res.status(404).json({ success: false, message: "Amount entry not found." });
    }

    // Same visibility rule as update/delete below: SA sees any entry,
    // everyone else only the ones they recorded.
    const isSA = user.role === "SA";
    const isOwnEntry = String(entry.recordedBy) === String(user.id);
    if (!isSA && !isOwnEntry) {
      return res.status(403).json({
        success: false,
        message: "You can only view amount entries you recorded.",
      });
    }

    return res.status(200).json({ success: true, message: "Amount entry fetched", data: entry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateAmountEntry = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { amount, description } = req.body;

    const entry = await AmountEntry.findById(id);
    if (!entry || !entry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Amount entry not found.",
      });
    }

    // SA can edit any entry; anyone else only the entries they recorded.
    const isSA = user.role === "SA";
    const isOwnEntry = String(entry.recordedBy) === String(user.id);
    if (!isSA && !isOwnEntry) {
      return res.status(403).json({
        success: false,
        message: "You can only edit amount entries you recorded.",
      });
    }

    if (amount !== undefined) entry.amount = Number(amount);
    if (description !== undefined) entry.description = description;
    await entry.save();

    return res.status(200).json({
      success: true,
      message: "Amount entry updated successfully",
      data: entry,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteAmountEntry = async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    const entry = await AmountEntry.findById(id);
    if (!entry || !entry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Amount entry not found.",
      });
    }

    // SA can delete any entry; anyone else only the entries they recorded.
    const isSA = user.role === "SA";
    const isOwnEntry = String(entry.recordedBy) === String(user.id);
    if (!isSA && !isOwnEntry) {
      return res.status(403).json({
        success: false,
        message: "You can only delete amount entries you recorded.",
      });
    }

    entry.isActive = false;
    await entry.save();

    return res.status(200).json({
      success: true,
      message: "Amount entry deleted successfully",
      data: { _id: id },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get amount summary for dashboard (studio-wide — needs amounts.summary.sa)
const getAmountSummary = async (req, res) => {
  try {
    const { user } = req;

    if (!hasPermission(user, "amounts.summary.sa")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view studio-wide totals.",
      });
    }

    // Preserved from the original SA-only handler (always false for the SA).
    const isEmployee = user?.role === "U";

    let employeeFilter = { isActive: true };
    let clientFilter = { isActive: true };

    if (isEmployee) {
      employeeFilter._id = user.id;
    }

    const employees = await User.find({ ...employeeFilter, role: "U" })
      .select("-password")
      .lean();
    const clients = await Client.find(clientFilter).lean();

    // Get all tickets with employee assignments
    let ticketFilter = {};
    if (isEmployee) {
      ticketFilter = {
        $or: [
          { assignedEmployee: user.id, status: { $in: ["inProgress", "completed", "hold"] } },
        ],
      };
    }

    const tickets = await Ticket.find(ticketFilter).lean();

    const employeeEarningsMap = {};
    employees.forEach((emp) => {
      employeeEarningsMap[emp._id.toString()] = {
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        userName: emp.userName,
        totalTickets: 0,
        totalAmount: 0,
        completedFinalized: 0,
      };
    });

    tickets.forEach((t) => {
      const empId = String(t.assignedEmployee || "");
      if (employeeEarningsMap[empId]) {
        const isCompletedAndFinalized =
          t.status === "completed" && t.isFinalized;
        const financials = calculateTicketFinancials(t);
        const earnings = financials.employeeEarnings;

        if (isCompletedAndFinalized) {
          employeeEarningsMap[empId].totalAmount += earnings;
          employeeEarningsMap[empId].completedFinalized += 1;
        }
        employeeEarningsMap[empId].totalTickets += 1;
      }
    });

    // Get amount entries for employees
    const employeeIds = Object.keys(employeeEarningsMap);
    const entries = await AmountEntry.find({
      recipientType: "employee",
      isActive: true,
    }).lean();

    // Calculate amounts sent to employees by SA
    const sentAmountMap = {};
    entries.forEach((e) => {
      const empId = String(e.recipient);
      if (!sentAmountMap[empId]) {
        sentAmountMap[empId] = {
          totalSent: 0,
          totalReceived: 0,
        };
      }
      if (e.type === "sent") {
        sentAmountMap[empId].totalSent += e.amount;
      } else if (e.type === "received") {
        sentAmountMap[empId].totalReceived += e.amount;
      }
    });

    // Calculate client totals
    const clientTickets = await Ticket.find({ client: { $ne: null } }).lean();
    const clientTotalsMap = {};
    clients.forEach((c) => {
      clientTotalsMap[c._id.toString()] = {
        _id: c._id,
        name: c.name,
        sortName: c.sortName,
        company: c.company,
        totalWorkAmount: 0,
        paidAmount: 0,
        balanceDue: 0,
      };
    });

    clientTickets.forEach((t) => {
      const clientId = String(t.client || "");
      if (clientTotalsMap[clientId]) {
        const { calculatedMainAmount } = calculateTicketFinancials(t);
        clientTotalsMap[clientId].totalWorkAmount += calculatedMainAmount;
      }
    });

    const clientEntries = await AmountEntry.find({
      recipientType: "client",
      isActive: true,
    }).lean();

    clientEntries.forEach((e) => {
      const clientId = String(e.recipient);
      if (clientTotalsMap[clientId]) {
        clientTotalsMap[clientId].paidAmount += e.amount;
      }
    });

    // Calculate balance for each client
    Object.keys(clientTotalsMap).forEach((key) => {
      clientTotalsMap[key].balanceDue =
        clientTotalsMap[key].totalWorkAmount - clientTotalsMap[key].paidAmount;
    });

    // SA totals
    const saTotalEmployeeAmount = Object.values(employeeEarningsMap).reduce(
      (sum, e) => sum + e.totalAmount,
      0
    );
    const saTotalMainAmount = tickets.reduce((sum, t) => {
      const { calculatedMainAmount } = calculateTicketFinancials(t);
      return sum + calculatedMainAmount;
    }, 0);
    const saTotalSentToEmployees = Object.values(sentAmountMap).reduce(
      (sum, e) => sum + e.totalSent,
      0
    );
    const saPendingFromEmployees = saTotalEmployeeAmount - saTotalSentToEmployees;

    const saTotalClientAmount = Object.values(clientTotalsMap).reduce(
      (sum, c) => sum + c.totalWorkAmount,
      0
    );
    const saTotalReceivedFromClients = Object.values(clientTotalsMap).reduce(
      (sum, c) => sum + c.paidAmount,
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        employeeSummary: Object.values(employeeEarningsMap),
        clientSummary: Object.values(clientTotalsMap),
        saTotals: {
          totalEmployeeAmount: saTotalEmployeeAmount,
          totalMainAmount: saTotalMainAmount,
          profit: saTotalMainAmount - saTotalEmployeeAmount,
          totalSentToEmployees: saTotalSentToEmployees,
          pendingFromEmployees: saPendingFromEmployees,
          totalClientAmount: saTotalClientAmount,
          totalReceivedFromClients: saTotalReceivedFromClients,
          pendingFromClients: saTotalClientAmount - saTotalReceivedFromClients,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get employee specific summary (for employee dashboard)
const getEmployeeSummary = async (req, res) => {
  try {
    const { user } = req;
    const userId = user.id;

    // Get tickets assigned to this employee that are completed and finalized
    const completedFinalizedTickets = await Ticket.find({
      assignedEmployee: userId,
      status: "completed",
      isFinalized: true,
    }).lean();

    const totalEarnings = completedFinalizedTickets.reduce((sum, t) => {
      const { employeeEarnings } = calculateTicketFinancials(t);
      return sum + employeeEarnings;
    }, 0);

    const completedCount = completedFinalizedTickets.length;

    // Net amount already settled with this employee (sent out − received back).
    const paidEntries = await AmountEntry.find({
      recipient: userId,
      recipientType: "employee",
      isActive: true,
    }).lean();

    const totalSent = paidEntries.reduce(
      (sum, e) => sum + (e.type === "sent" ? Number(e.amount || 0) : -Number(e.amount || 0)),
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        totalTickets: completedFinalizedTickets.length,
        completedFinalizedCount: completedCount,
        totalEarnings: totalEarnings,
        totalAmountReceived: totalSent,
        pendingAmount: totalEarnings - totalSent,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAmountEntries,
  getAmountEntryById,
  createAmountEntry,
  updateAmountEntry,
  deleteAmountEntry,
  getAmountSummary,
  getEmployeeSummary,
};
