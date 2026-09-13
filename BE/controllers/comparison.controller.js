const User = require("../models/user.model");
const Ticket = require("../models/ticket.model");
const AmountEntry = require("../models/amountEntry.model");
const Profile = require("../models/profile.model");
const { ERole } = require("../constants");
const { calculateTicketFinancials } = require("../utils/ticket-financials");

const parseFrom = (s) => {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const parseTo = (s) => {
  if (!s) return null;
  const d = new Date(`${s}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const inRange = (value, from, to) => {
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
};

// GET /api/comparison/employees?from=YYYY-MM-DD&to=YYYY-MM-DD
const getEmployeeComparison = async (req, res) => {
  try {
    const from = parseFrom(req.query.from);
    const to = parseTo(req.query.to);

    const [employees, tickets, profiles, entries] = await Promise.all([
      User.find({ role: ERole.U }).select("firstName lastName userName isActive").lean(),
      Ticket.find({}).lean(),
      Profile.find({}).select("userId percentage").lean(),
      AmountEntry.find({ recipientType: "employee", isActive: true }).lean(),
    ]);

    const pctByUser = {};
    profiles.forEach((p) => {
      pctByUser[String(p.userId)] = Number(p.percentage || 0);
    });

    const rowByUser = {};
    employees.forEach((e) => {
      rowByUser[String(e._id)] = {
        _id: e._id,
        name: `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.userName,
        userName: e.userName,
        isActive: e.isActive !== false,
        percentage: pctByUser[String(e._id)] || 0,
        ticketsAssigned: 0,
        ticketsCompleted: 0,
        ticketsFinalized: 0,
        workValue: 0,
        earnings: 0,
        paid: 0,
        balanceDue: 0,
      };
    });

    tickets.forEach((t) => {
      const row = rowByUser[String(t.assignedEmployee || "")];
      if (!row) return;
      if (!inRange(t.createdAt, from, to)) return;

      const fin = calculateTicketFinancials(t);
      row.ticketsAssigned += 1;
      row.workValue += fin.calculatedMainAmount;
      if (t.status === "completed") row.ticketsCompleted += 1;
      if (t.status === "completed" && t.isFinalized) {
        row.ticketsFinalized += 1;
        row.earnings += fin.employeeEarnings;
      }
    });

    entries.forEach((e) => {
      const row = rowByUser[String(e.recipient || "")];
      if (!row) return;
      if (!inRange(e.entryDate || e.createdAt, from, to)) return;
      const amt = Number(e.amount || 0);
      row.paid += e.type === "sent" ? amt : -amt;
    });

    const data = Object.values(rowByUser)
      .map((r) => ({
        ...r,
        workValue: Math.round(r.workValue),
        earnings: Math.round(r.earnings),
        paid: Math.round(r.paid),
        balanceDue: Math.round(r.earnings - r.paid),
      }))
      .sort((a, b) => b.earnings - a.earnings);

    return res.status(200).json({
      success: true,
      data,
      range: { from: req.query.from || "", to: req.query.to || "" },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getEmployeeComparison };
