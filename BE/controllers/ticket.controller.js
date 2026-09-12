const Ticket = require("../models/ticket.model");
const User = require("../models/user.model");
const Client = require("../models/client.model");
const AmountEntry = require("../models/amountEntry.model");
const Profile = require("../models/profile.model");
const { createNotification, emitTicketEvent } = require("../services/notification.service");
const {
  PRIORITY,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_COLORS,
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  ERole,
} = require("../constants");
const { calculateTicketFinancials } = require("../utils/ticket-financials");
const { hasPermission } = require("../utils/permissions");
const {
  getActiveTicketTypes,
  getTicketTypeMap,
  ticketTypeColor: colorOfTicketType,
} = require("../utils/ticket-types");

const isJobTicketType = (t) => typeof t === "string" && t.endsWith("Job");

// Hour fields (HR / Main HR / HR price) only apply to job-type tickets.
const normalizeHourFields = (ticket) => {
  if (!isJobTicketType(ticket.ticketType)) {
    ticket.HR = null;
    ticket.mainHr = null;
    ticket.hrPrice = 0;
  }
};

// Display fields for a ticket's type. A type an SA deleted still renders —
// it falls back to the built-in constants, then to the raw key.
const ticketTypeView = (type, key) => ({
  ticketTypeLabel: type?.label || TICKET_TYPES[key] || key,
  ticketTypeVariant: type?.variant || "neutral",
  ticketTypeColor: type
    ? colorOfTicketType(type)
    : TICKET_TYPE_COLORS[key] || "#8792AC",
});

// Build [{ value, label, color }] option lists from the shared constant maps.
const toOptions = (valueMap, labelMap, colorMap) =>
  Object.keys(valueMap).map((value) => ({
    value,
    label: labelMap[value] || value,
    color: (colorMap && colorMap[value]) || "#8792AC",
  }));

const getTickets = async (req, res) => {
  try {
    const { user } = req;
    // "See every ticket + financial figures" — SA, or anyone granted tickets.viewAll.
    // Everyone else is scoped to the tickets assigned to / created by them.
    const isSuperAdmin = hasPermission(user, "tickets.viewAll");
    const isAssignedTo = !isSuperAdmin;

    let filter = {};

    if (isAssignedTo) {
      filter.$or = [
        { assignedEmployee: user.id, status: { $in: ["inProgress", "completed", "hold"] } },
        { userId: user.id, assignedEmployee: null, status: { $in: ["inProgress", "completed", "hold"] } },
      ];
    }

    const tickets = await Ticket.find(filter).sort({ createdAt: -1 });

    const userIds = [
      ...new Set(tickets.map((t) => t.createdBy || t.userId)),
    ];
    const employeeIds = tickets
      .map((t) => t.assignedEmployee)
      .filter((id) => id);
    const clientIds = tickets.map((t) => t.client).filter((id) => id);

    const allUserIds = [...new Set([...userIds, ...employeeIds])];

    const users = await User.find({
      _id: { $in: allUserIds },
    })
      .select("-password")
      .lean();

    const clients = await Client.find({
      _id: { $in: clientIds },
    }).lean();

    // SA-managed labels / colours for the types these tickets carry.
    const ticketTypeMap = await getTicketTypeMap();

    // Payments already made to the assigned employee against each ticket.
    const ticketIdStrings = tickets.map((t) => t._id.toString());
    const paidEntries = await AmountEntry.find({
      ticketId: { $in: ticketIdStrings },
      recipientType: "employee",
      isActive: true,
    }).lean();
    const paidByTicket = {};
    paidEntries.forEach((e) => {
      const tid = String(e.ticketId);
      const delta = e.type === "sent" ? Number(e.amount || 0) : -Number(e.amount || 0);
      paidByTicket[tid] = (paidByTicket[tid] || 0) + delta;
    });

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = {
        _id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        userName: u.userName,
        email: u.email,
        role: u.role,
      };
    });

    const clientMap = {};
    clients.forEach((c) => {
      clientMap[c._id.toString()] = c;
    });

    // Fields only the SA is allowed to see — stripped from every other role's
    // response so they can never be read straight off the API.
    const SA_ONLY_TICKET_FIELDS = [
      "mainAmount",
      "mainHr",
      "hrPrice",
      "calculatedMainAmount",
      "companyProfit",
      "employeeEarnings",
      "employeePaid",
      "balanceDue",
    ];
    const nameOf = (details, fallback) =>
      details
        ? `${details.firstName || ""} ${details.lastName || ""}`.trim() || details.userName || fallback || ""
        : fallback || "";

    const enrichedTickets = tickets.map((t) => {
      const ticketObj = t.toObject();
      const financials = calculateTicketFinancials(t);
      const paid = paidByTicket[t._id.toString()] || 0;

      const creatorDetails = userMap[t.createdBy || t.userId] || null;
      const employeeDetails = t.assignedEmployee ? userMap[t.assignedEmployee] || null : null;
      const clientDetails = t.client ? clientMap[t.client] || null : null;

      const enriched = {
        ...ticketObj,
        priorityColor: PRIORITY_COLORS[t.priorety] || "#8792AC",
        ...ticketTypeView(ticketTypeMap[t.ticketType], t.ticketType),
        creatorDetails,
        employeeDetails,
        clientDetails,
        // Display names are resolved from the linked id every read, so renaming
        // a user / client anywhere reflects on every ticket instantly.
        createdByName: nameOf(creatorDetails, ticketObj.createdByName),
        assignedEmployeeName: nameOf(employeeDetails, ""),
        clientName: clientDetails ? clientDetails.name || "" : "",
        // Client photo, so ticket rows can show the same avatar as the client list.
        clientPhoto: clientDetails ? clientDetails.image || "" : "",
        ...financials,
        hrPrice: Number(t.hrPrice || 0),
        // What the studio still owes the assigned employee for this ticket.
        employeePaid: paid,
        balanceDue: financials.employeeEarnings - paid,
      };

      if (!isSuperAdmin) {
        SA_ONLY_TICKET_FIELDS.forEach((f) => delete enriched[f]);
      }

      return enriched;
    });

    return res.status(200).json({
      success: true,
      message: "Tickets fetched successfully",
      data: enrichedTickets,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createTicket = async (req, res) => {
  try {
    const { user } = req;
    const {
      coupleName,
      ticketType,
      HR,
      mainHr,
      priorety,
      amount,
      mainAmount,
      deleveryDate,
      userPersentage,
      assignedEmployee,
      client,
      remark,
      status,
      hrPrice,
    } = req.body;

    if (client) {
      const clientDoc = await Client.findById(client);
      if (!clientDoc || !clientDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid or inactive client.",
        });
      }
    }

    // Creator identity always comes from the authenticated session, never the body.
    const createdByName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userName;

    // Hour fields only exist for job-type tickets — otherwise stored as null.
    const isJobType = isJobTicketType(ticketType);

    // SA-only fields: employees cannot set these
    let ticketData = {
      userId: user.id,
      createdBy: user.id,
      createdByName,
      // An employee's own ticket is self-assigned by default, so an SA
      // editing it later sees the assignee (and its profit-share %)
      // already selected instead of having to pick it manually.
      assignedEmployee: user.role === ERole.U ? user.id : null,
      client: client || null,
      coupleName,
      ticketType,
      HR: isJobType ? HR : null,
      mainHr: isJobType ? mainHr || null : null,
      priorety: priorety || "medium",
      amount: user.role === ERole.SA ? amount : "",
      mainAmount: user.role === ERole.SA ? mainAmount : "",
      hrPrice: user.role === ERole.SA && isJobType ? hrPrice || 0 : 0,
      deleveryDate,
      userPersentage: user.role === ERole.SA ? userPersentage : "",
      status: status || TICKET_STATUS.pending,
      remark: remark || "",
    };

    // SA can assign employees, employees cannot
    if (user.role === ERole.SA && assignedEmployee) {
      const employeeDoc = await User.findById(assignedEmployee);
      if (!employeeDoc || employeeDoc.role !== ERole.U || !employeeDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee.",
        });
      }

      ticketData.assignedEmployee = assignedEmployee;

      await createNotification({
        recipient: assignedEmployee,
        type: "TICKET_ASSIGNED",
        title: "New Ticket Assigned",
        message: `${coupleName || "New ticket"} assigned to you by ${createdByName || "SA"}`,
        ticketId: undefined,
        actorId: user.id,
      });
    }

    const newTicket = await Ticket.create(ticketData);

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: newTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const isSuperAdmin = user.role === ERole.SA;
    const isEmployee = user.role === ERole.U;

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (isEmployee) {
      const isAssignee = String(ticket.assignedEmployee) === String(user.id);
      const isCreator = String(ticket.createdBy) === String(user.id);
      if (!isAssignee && !isCreator) {
        return res.status(403).json({
          success: false,
          message: "You can only edit tickets you created or are assigned to.",
        });
      }

      // Once the SA finalizes a ticket, only the SA can change it.
      if (ticket.isFinalized) {
        return res.status(403).json({
          success: false,
          message: "This ticket has been finalized — contact your admin to make changes.",
        });
      }

      const allowedFields = [
        "ticketType",
        "HR",
        "mainHr",
        "remark",
        "priorety",
        "deleveryDate",
        "status",
      ];

      const updates = {};
      const changedFields = [];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
          if (ticket[field] !== req.body[field]) {
            changedFields.push(field);
          }
        }
      });

      Object.assign(ticket, updates);
      normalizeHourFields(ticket);
      await ticket.save();

      if (changedFields.length > 0 && ticket.createdBy) {
        const employeeName =
          user.firstName || user.userName || "Employee";
        await createNotification({
          recipient: ticket.createdBy,
          type: "TICKET_UPDATED",
          title: "Ticket Updated",
          message: `${employeeName} updated field(s): ${changedFields.join(", ")} on ticket ${ticket.coupleName || ticket.createdByName}`,
          ticketId: id,
          actorId: user.id,
        });
      }

      emitTicketEvent("ticket-updated", ticket.toObject(), ticket._id.toString());

      return res.status(200).json({
        success: true,
        message: "Ticket updated",
        data: ticket,
      });
    }

    if (isSuperAdmin) {
      const allowedFields = [
        "ticketType", "priorety", "amount", "mainAmount", "hrPrice", "deleveryDate",
        "userPersentage", "assignedEmployee", "client",
        "remark", "status", "HR", "mainHr",
        "coupleName",
        "isFinalized",
      ];

      const updates = {};
      const changedFields = [];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
          if (ticket[field] !== req.body[field]) {
            changedFields.push(field);
          }
        }
      });

      const wasFinalized = ticket.isFinalized;
      Object.assign(ticket, updates);
      normalizeHourFields(ticket);

      // finalizedBy/At are audit fields — always derived server-side (never
      // trusted from the client) so toggling isFinalized here stays
      // consistent with the dedicated /finalize endpoint either direction.
      if (updates.isFinalized !== undefined && updates.isFinalized !== wasFinalized) {
        ticket.finalizedBy = updates.isFinalized ? user.id : null;
        ticket.finalizedAt = updates.isFinalized ? new Date() : null;
      }

      // A ticket can only be finalized once it is completed.
      if (ticket.isFinalized && ticket.status !== TICKET_STATUS.completed) {
        ticket.isFinalized = false;
        ticket.finalizedBy = null;
        ticket.finalizedAt = null;
      }
      await ticket.save();

      if (changedFields.length > 0 && ticket.assignedEmployee) {
        await createNotification({
          recipient: ticket.assignedEmployee,
          type: "TICKET_UPDATED",
          title: "Ticket Updated",
          message: `Ticket ${ticket.coupleName || ticket.createdByName} was updated. Field(s): ${changedFields.join(", ")}`,
          ticketId: id,
          actorId: user.id,
        });
      }

      emitTicketEvent("ticket-updated", ticket.toObject(), ticket._id.toString());

      return res.status(200).json({
        success: true,
        message: "Ticket updated",
        data: ticket,
      });
    }

    return res.status(403).json({
      success: false,
      message: "Unauthorized to update ticket.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const assignEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedEmployee } = req.body;
    const { user } = req;

    if (!hasPermission(user, "tickets.assign")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to assign employees.",
      });
    }

    if (assignedEmployee) {
      const employee = await User.findById(assignedEmployee).lean();
      if (!employee || employee.role !== ERole.U || !employee.isActive) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee.",
        });
      }
    }

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { assignedEmployee: assignedEmployee || null },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Emit socket event if employee assigned
    if (assignedEmployee) {
      const employee = await User.findById(assignedEmployee).lean();
      if (employee) {
        const creatorName = user.firstName || user.userName || "SA";
        await createNotification({
          recipient: assignedEmployee,
          type: "TICKET_ASSIGNED",
          title: "New Ticket Assigned",
          message: `${ticket.coupleName || ticket.createdByName || "A ticket"} assigned to you by ${creatorName}`,
          ticketId: id,
          actorId: user.id,
        });
      }
    }

    emitTicketEvent("ticket-assigned", ticket.toObject(), id);

    return res.status(200).json({
      success: true,
      message: "Employee assigned",
      data: ticket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const completeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (user.role === ERole.U) {
      if (String(ticket.assignedEmployee) !== String(user.id)) {
        return res.status(403).json({
          success: false,
          message: "Not assigned to you.",
        });
      }

      if (ticket.isFinalized) {
        return res.status(403).json({
          success: false,
          message: "This ticket has been finalized and can no longer be changed.",
        });
      }

      // Job tickets need work hours before completing so the payout can be calculated.
      if (isJobTicketType(ticket.ticketType) && (ticket.HR === null || ticket.HR === undefined || `${ticket.HR}`.trim() === "")) {
        return res.status(400).json({
          success: false,
          message: "Add work hours (HR) before completing this ticket.",
        });
      }

      ticket.status = TICKET_STATUS.completed;
      await ticket.save();

      // Notify creator
      if (ticket.createdBy) {
        await createNotification({
          recipient: ticket.createdBy,
          type: "TICKET_COMPLETED",
          title: "Ticket Completed",
          message: `${ticket.coupleName} marked as completed`,
          ticketId: id,
          actorId: user.id,
        });
      }

      emitTicketEvent("ticket-completed", ticket.toObject(), id);

      return res.status(200).json({
        success: true,
        message: "Ticket completed",
        data: ticket,
      });
    }

    return res.status(403).json({
      success: false,
      message: "Only assigned employees can complete tickets.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const finalizeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const { isFinalized } = req.body;

    if (!hasPermission(user, "tickets.finalize")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to finalize tickets.",
      });
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // A ticket can only be finalized once it is completed.
    if (isFinalized && ticket.status !== TICKET_STATUS.completed) {
      return res.status(400).json({
        success: false,
        message: "Complete the ticket first — it can only be finalized once completed.",
      });
    }

    ticket.isFinalized = isFinalized;
    ticket.finalizedBy = isFinalized ? user.id : null;
    ticket.finalizedAt = isFinalized ? new Date() : null;
    await ticket.save();

    // Notify assigned employee if finalized
    if (isFinalized && ticket.assignedEmployee) {
      await createNotification({
        recipient: ticket.assignedEmployee,
        type: "TICKET_FINALIZED",
        title: "Ticket Finalized",
        message: `${ticket.coupleName} has been finalized`,
        ticketId: id,
        actorId: user.id,
      });
    }

    emitTicketEvent("ticket-finalized", ticket.toObject(), id);

    return res.status(200).json({
      success: true,
      message: "Ticket finalized",
      data: ticket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const isSuperAdmin = user?.role === ERole.SA;

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!isSuperAdmin) {
      if (user.role === ERole.U) {
        if (
          String(ticket.assignedEmployee) !== String(user.id) &&
          String(ticket.createdBy) !== String(user.id)
        ) {
          return res.status(403).json({
            success: false,
            message: "You are not assigned to this ticket.",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to view ticket.",
        });
      }
    }

    const data = ticket.toObject();
    if (!isSuperAdmin) {
      // Money/main-hour fields belong to the SA only.
      delete data.mainAmount;
      delete data.mainHr;
      delete data.hrPrice;
    }

    return res.status(200).json({
      success: true,
      message: "Ticket fetched",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get ticket comments
const getTicketComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const isSuperAdmin = user?.role === ERole.SA;
    const isEmployee = user?.role === ERole.U;
 
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
 
    let canView = isSuperAdmin;
    if (isEmployee) {
      canView =
        String(ticket.assignedEmployee) === String(user.id) ||
        String(ticket.createdBy) === String(user.id);
    }
 
    if (!canView) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
 
    return res.status(200).json({
      success: true,
      message: "Comments fetched",
      data: ticket.comments || [],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
 
// Add comment to ticket
const addTicketComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const { text } = req.body;
 
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
 
    const isSuperAdmin = user?.role === ERole.SA;
    const isEmployee = user?.role === ERole.U;
    let canComment = isSuperAdmin;
 
    if (isEmployee) {
      canComment =
        String(ticket.assignedEmployee) === String(user.id) ||
        String(ticket.createdBy) === String(user.id);
    }
 
    if (!canComment) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
 
    if (!ticket.comments) {
      ticket.comments = [];
    }
    ticket.comments.push({
      userId: user.id,
      text: text,
      createdAt: new Date(),
    });
    await ticket.save();
 
    return res.status(201).json({
      success: true,
      message: "Comment added",
      data: ticket.comments[ticket.comments.length - 1],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
 
// Options for every ticket-form dropdown, in one request.
const getTicketFormMeta = async (req, res) => {
  try {
    const [ticketTypes, clients, employees] = await Promise.all([
      getActiveTicketTypes(),
      Client.find({ isActive: true }).select("name company").sort({ name: 1 }).lean(),
      User.find({ role: ERole.U, isActive: true })
        .select("firstName lastName userName")
        .sort({ firstName: 1 })
        .lean(),
    ]);

    // Each user's SA-set profit share, so the ticket form can auto-fill it.
    const profiles = await Profile.find({
      userId: { $in: employees.map((u) => String(u._id)) },
    })
      .select("userId percentage")
      .lean();
    const pctByUser = {};
    profiles.forEach((p) => {
      pctByUser[String(p.userId)] = Number(p.percentage || 0);
    });

    return res.status(200).json({
      success: true,
      message: "Ticket form meta fetched",
      data: {
        ticketTypes: ticketTypes.map((t) => ({
          value: t.key,
          label: t.label,
          color: colorOfTicketType(t),
          variant: t.variant,
          isJob: !!t.isJob,
        })),
        priorities: [PRIORITY.high, PRIORITY.medium, PRIORITY.low].map((value) => ({
          value,
          label: PRIORITY_LABELS[value],
          color: PRIORITY_COLORS[value] || "#8792AC",
        })),
        statuses: toOptions(TICKET_STATUS, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS),
        clients: clients.map((c) => ({
          value: String(c._id),
          label: c.company ? `${c.name} (${c.company})` : c.name,
        })),
        employees: employees.map((u) => ({
          value: String(u._id),
          label: `${u.firstName} ${u.lastName} (@${u.userName})`,
          percentage: pctByUser[String(u._id)] || 0,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete ticket
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (!hasPermission(user, "tickets.delete")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete tickets.",
      });
    }
 
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }
 
    await Ticket.findByIdAndDelete(id);
 
    emitTicketEvent("ticket-deleted", { _id: id }, null);
 
    return res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
      data: { _id: id },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
 
module.exports = {
  getTickets,
  getTicketById,
  getTicketFormMeta,
  createTicket,
  updateTicket,
  deleteTicket,
  assignEmployee,
  completeTicket,
  finalizeTicket,
  getTicketComments,
  addTicketComment,
};
