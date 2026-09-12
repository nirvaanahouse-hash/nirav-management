const TicketType = require("../models/ticketType.model");
const Ticket = require("../models/ticket.model");
const {
  getTicketTypes,
  buildTicketTypeKey,
  ticketTypeColor,
  invalidateTicketTypeCache,
} = require("../utils/ticket-types");

const asBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === "true";
};

/** How many tickets already reference each type key. */
const getUsageCounts = async () => {
  const rows = await Ticket.aggregate([
    { $group: { _id: "$ticketType", count: { $sum: 1 } } },
  ]);
  const counts = {};
  rows.forEach((r) => {
    counts[r._id] = r.count;
  });
  return counts;
};

const toResponse = (type, usage = 0) => ({
  _id: String(type._id),
  key: type.key,
  label: type.label,
  variant: type.variant,
  color: ticketTypeColor(type),
  isJob: type.isJob,
  isActive: type.isActive,
  showCount: !!type.showCount,
  sortOrder: type.sortOrder,
  usageCount: usage,
  createdAt: type.createdAt,
  updatedAt: type.updatedAt,
});

// GET /api/ticket-type
const listTicketTypes = async (req, res) => {
  try {
    const [types, usage] = await Promise.all([getTicketTypes(), getUsageCounts()]);

    return res.status(200).json({
      success: true,
      message: "Ticket types fetched successfully",
      data: types.map((t) => toResponse(t, usage[t.key] || 0)),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ticket-type
const createTicketType = async (req, res) => {
  try {
    const label = String(req.body.label || "").trim();
    const isJob = asBool(req.body.isJob, false);
    const key = buildTicketTypeKey(label, isJob);

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Type name must contain at least one letter or number.",
        errors: [{ field: "label", message: "Enter a name with letters or numbers." }],
      });
    }

    // The "Job" suffix is what marks an hour-wise type everywhere else, so a
    // flat-priced type may not be named in a way that produces it.
    if (!isJob && key.endsWith("Job")) {
      return res.status(400).json({
        success: false,
        message: 'A type named "…Job" must use hour-wise pricing.',
        errors: [
          {
            field: "label",
            message: 'Tick "hour-wise pricing" for a JOB type, or rename it.',
          },
        ],
      });
    }

    const clash = await TicketType.findOne({ key }).lean();
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `"${clash.label}" already uses this name.`,
        errors: [{ field: "label", message: "This ticket type already exists." }],
      });
    }

    const last = await TicketType.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean();

    const type = await TicketType.create({
      key,
      label,
      variant: req.body.variant || "neutral",
      isJob,
      isActive: asBool(req.body.isActive, true),
      showCount: asBool(req.body.showCount, false),
      sortOrder: (last?.sortOrder ?? -1) + 1,
      createdBy: req.user?.id || null,
    });

    invalidateTicketTypeCache();

    return res.status(201).json({
      success: true,
      message: "Ticket type added",
      data: toResponse(type.toObject(), 0),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/ticket-type/:id
const updateTicketType = async (req, res) => {
  try {
    const type = await TicketType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ success: false, message: "Ticket type not found" });
    }

    // `key` and `isJob` stay frozen — tickets already point at this key.
    if (req.body.label !== undefined) type.label = String(req.body.label).trim();
    if (req.body.variant !== undefined) type.variant = req.body.variant;
    if (req.body.isActive !== undefined) type.isActive = asBool(req.body.isActive, type.isActive);
    if (req.body.showCount !== undefined) type.showCount = asBool(req.body.showCount, type.showCount);
    if (req.body.sortOrder !== undefined) type.sortOrder = Number(req.body.sortOrder);

    await type.save();
    invalidateTicketTypeCache();

    const usage = await Ticket.countDocuments({ ticketType: type.key });

    return res.status(200).json({
      success: true,
      message: "Ticket type updated",
      data: toResponse(type.toObject(), usage),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/ticket-type/:id
const deleteTicketType = async (req, res) => {
  try {
    const type = await TicketType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ success: false, message: "Ticket type not found" });
    }

    // Deleting a type that tickets still use would leave those tickets with an
    // unresolvable label — hide it instead.
    const usage = await Ticket.countDocuments({ ticketType: type.key });
    if (usage > 0) {
      return res.status(409).json({
        success: false,
        message: `${usage} ticket${usage === 1 ? "" : "s"} still ${usage === 1 ? "uses" : "use"} "${type.label}". Turn it off instead so it stays readable on those tickets.`,
        usageCount: usage,
      });
    }

    await type.deleteOne();
    invalidateTicketTypeCache();

    return res.status(200).json({
      success: true,
      message: "Ticket type deleted",
      data: { _id: String(type._id), key: type.key },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
};
