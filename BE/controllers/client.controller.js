const Client = require("../models/client.model");
const Ticket = require("../models/ticket.model");
const AmountEntry = require("../models/amountEntry.model");
const { calculateTicketFinancials } = require("../utils/ticket-financials");
const { escapeRegex } = require("../utils/validate");
const { buildClientInvoicePdf } = require("../utils/invoice-pdf");
const { TICKET_STATUS } = require("../constants");
const { hasPermission } = require("../utils/permissions");
const { removeUploadedFile } = require("../utils/uploads");
const { emitScopedEvent } = require("../services/notification.service");
const fs = require("fs");

// Same totalWorkAmount/paidAmount/balanceDue the list endpoint (getClient)
// computes per row — every mutation below needs it too, since these values
// are what the Clients table actually renders and both the HTTP response
// and the live socket push must carry them, not just a bare Client doc.
async function enrichClient(client) {
  const clientObj = client.toObject ? client.toObject() : client;
  const cid = String(clientObj._id);
  const [tickets, amountEntries] = await Promise.all([
    Ticket.find({ client: cid }).lean(),
    AmountEntry.find({ recipient: cid, recipientType: "client", isActive: true }).lean(),
  ]);
  const totalWorkAmount = tickets.reduce(
    (sum, t) => sum + calculateTicketFinancials(t).calculatedMainAmount,
    0,
  );
  const paidAmount = amountEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  return { ...clientObj, totalWorkAmount, paidAmount, balanceDue: totalWorkAmount - paidAmount };
}

// Get all clients (active by default, SA can see all)
const getClient = async (req, res) => {
  try {
    const { isActive, search } = req.query;
    const filter = {};

    // Default: only show active clients (unless SA explicitly requests inactive)
    const userRole = req.user?.role;
    const isSA = userRole === "SA";

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    } else if (!isSA) {
      filter.isActive = true;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { name: regex },
        { sortName: regex },
        { company: regex },
        { mobileNumber: regex },
        { email: regex },
      ];
    }

    const clients = await Client.find(filter).sort({ createdAt: -1 }).lean();

    const clientIds = clients.map((c) => c._id.toString());

    const [tickets, amountEntries] = await Promise.all([
      Ticket.find({ client: { $in: clientIds } }).lean(),
      AmountEntry.find({
        recipient: { $in: clientIds },
        recipientType: "client",
        isActive: true,
      }).lean(),
    ]);

    const ticketTotalsMap = {};
    tickets.forEach((t) => {
      const cid = String(t.client || "");
      const financials = calculateTicketFinancials(t);
      ticketTotalsMap[cid] = (ticketTotalsMap[cid] || 0) + financials.calculatedMainAmount;
    });

    const paidMap = {};
    amountEntries.forEach((e) => {
      const cid = String(e.recipient);
      paidMap[cid] = (paidMap[cid] || 0) + Number(e.amount || 0);
    });

    const enrichedClients = clients.map((client) => {
      const cid = String(client._id);
      const totalWorkAmount = ticketTotalsMap[cid] || 0;
      const paidAmount = paidMap[cid] || 0;
      const balanceDue = totalWorkAmount - paidAmount;
      return { ...client, totalWorkAmount, paidAmount, balanceDue };
    });

    return res.status(200).json({
      success: true,
      message: "Clients fetched successfully",
      data: enrichedClients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single client by ID
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client fetched successfully",
      data: client,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get client stats (ticket work totals)
const getClientStats = async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const tickets = await Ticket.find({ client: clientId }).lean();
    const financials = tickets.map((t) => calculateTicketFinancials(t));
    const totalAmount = financials.reduce(
      (sum, f) => sum + f.calculatedMainAmount,
      0
    );

    const paidEntries = await AmountEntry.find({
      recipient: clientId,
      recipientType: "client",
      isActive: true,
    }).lean();

    const paidAmount = paidEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const balanceDue = totalAmount - paidAmount;

    return res.status(200).json({
      success: true,
      data: {
        totalTickets: tickets.length,
        totalWorkAmount: totalAmount,
        paidAmount,
        balanceDue,
        clientName: client.name,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create a client (needs clients.create — SA bypasses)
const postClient = async (req, res) => {
  try {
    const { user } = req;
    if (!hasPermission(user, "clients.create")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage clients.",
      });
    }

    const { paidAmount, balanceDue, ...clientData } = req.body;

    const newClient = await Client.create({
      ...clientData,
      supeAdminId: user.id,
      isActive: true,
    });

    // Brand new — no tickets/payments can exist for it yet, so the totals
    // are trivially zero (no need for enrichClient's queries).
    const enriched = { ...newClient.toObject(), totalWorkAmount: 0, paidAmount: 0, balanceDue: 0 };
    emitScopedEvent("client-created", enriched, { permission: "clients.view" });

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update a client (needs clients.edit — SA bypasses)
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (!hasPermission(user, "clients.edit")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage clients.",
      });
    }

    // Whitelist rather than blacklist — req.body is user-supplied, so this must
    // only ever apply fields the validator actually allows for an update, not
    // every OTHER field on the schema. A blacklist previously let anyone with
    // clients.edit alone smuggle in schema fields like isActive that are meant
    // to require clients.delete instead.
    const allowedFields = ["name", "sortName", "company", "email", "phone", "mobileNumber", "status"];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const updated = await Client.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const enriched = await enrichClient(updated);
    emitScopedEvent("client-updated", enriched, { permission: "clients.view" });

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Soft delete a client (needs clients.delete — SA bypasses) — sets isActive to false
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (!hasPermission(user, "clients.delete")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage clients.",
      });
    }

    const ticketsUsingClient = await Ticket.countDocuments({ client: id });

    const deleted = await Client.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const enriched = await enrichClient(deleted);
    emitScopedEvent("client-updated", enriched, { permission: "clients.view" });

    return res.status(200).json({
      success: true,
      message:
        ticketsUsingClient > 0
          ? "Client deactivated. Existing tickets still reference this client."
          : "Client deactivated successfully",
      data: enriched,
      hasTickets: ticketsUsingClient > 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get client payment entries
const getClientPayments = async (req, res) => {
  try {
    const { id } = req.params;
     const entries = await AmountEntry.find({
      recipient: id,
      recipientType: "client",
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Client payments fetched successfully",
      data: entries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reactivate a client (needs clients.edit — SA bypasses)
const reactivateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    if (!hasPermission(user, "clients.edit")) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage clients.",
      });
    }

    const reactivated = await Client.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true }
    );

    if (!reactivated) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const enriched = await enrichClient(reactivated);
    emitScopedEvent("client-updated", enriched, { permission: "clients.view" });

    return res.status(200).json({
      success: true,
      message: "Client reactivated successfully",
      data: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ---------------------------------------------------------------------------
// Billing / invoice PDF
// ---------------------------------------------------------------------------

const BILLING_MODES = new Set(["all", "current", "custom"]);

/** Completed + finalised tickets for a client, filtered by billing mode. */
const collectBillingTickets = async (clientId, mode, from, to) => {
  const filter = {
    client: String(clientId),
    status: TICKET_STATUS.completed,
    isFinalized: true,
  };
  // "Current" run only picks up work that has not been invoiced yet.
  if (mode === "current") filter.isPdf = { $ne: true };

  let tickets = await Ticket.find(filter)
    .sort({ deleveryDate: 1, createdAt: 1 })
    .lean();

  // Custom uses the ticket form date (deleveryDate, "YYYY-MM-DD" string).
  if (mode === "custom" && (from || to)) {
    tickets = tickets.filter((t) => {
      const d = t.deleveryDate || "";
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }
  return tickets;
};

/** Build the preview rows + money summary for a set of billing tickets. */
const buildBillingPayload = async (client, tickets, mode) => {
  const rows = tickets.map((t) => {
    const { calculatedMainAmount } = calculateTicketFinancials(t);
    return {
      _id: t._id,
      coupleName: t.coupleName || "",
      ticketType: t.ticketType,
      deleveryDate: t.deleveryDate || "",
      mainAmount: Math.round(calculatedMainAmount),
      isPdf: !!t.isPdf,
    };
  });

  // Sum of just the rows shown on this statement.
  const statementTotal = rows.reduce((sum, r) => sum + r.mainAmount, 0);

  // Work the client has ALREADY been invoiced for on earlier statements —
  // completed + finalised + isPdf === true. Excludes this run's own tickets
  // so a "current" run (which claims isPdf=true before we get here, see
  // downloadClientBillingPdf) never double-counts its own new rows as both
  // "prior invoiced" and "new work" in the same statement.
  const invoicedTickets = await Ticket.find({
    client: String(client._id),
    status: TICKET_STATUS.completed,
    isFinalized: true,
    isPdf: true,
    _id: { $nin: tickets.map((t) => t._id) },
  }).lean();
  const priorInvoiced = invoicedTickets.reduce(
    (sum, t) => sum + Math.round(calculateTicketFinancials(t).calculatedMainAmount),
    0,
  );

  // New work this statement puts on the bill. A "Current" run invoices its
  // rows right now (they flip to isPdf on download); "All"/"Custom" are just
  // re-prints of already-invoiced work, so they add nothing new.
  const newWork = mode === "current" ? statementTotal : 0;
  const invoicedTotal = priorInvoiced + newWork;

  // Every payment the client has made (SA records these separately —
  // downloading a PDF never creates a payment).
  const clientEntries = await AmountEntry.find({
    recipient: String(client._id),
    recipientType: "client",
    type: "received",
    isActive: true,
  }).lean();
  const received = clientEntries.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0,
  );

  // What the client owed BEFORE this statement's new work. Negative means the
  // client is in credit (paid ahead) and that credit offsets the new work.
  const previousBalance = priorInvoiced - received;
  // Everything still to collect once this statement's new work is added in.
  const pending = Math.max(0, invoicedTotal - received);

  return {
    rows,
    summary: {
      statementTotal,
      invoicedTotal,
      received,
      pending,
      newWork,
      previousBalance,
    },
  };
};

// GET /api/client/:id/billing?mode=all|current|custom&from=&to=
const getClientBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const mode = BILLING_MODES.has(req.query.mode) ? req.query.mode : "current";
    const from = req.query.from || "";
    const to = req.query.to || "";

    const client = await Client.findById(id).lean();
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const tickets = await collectBillingTickets(id, mode, from, to);
    const { rows, summary } = await buildBillingPayload(client, tickets, mode);

    return res.status(200).json({
      success: true,
      message: "Billing preview ready",
      data: {
        client: { _id: client._id, name: client.name, company: client.company || "" },
        mode,
        from,
        to,
        tickets: rows,
        summary,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/client/:id/billing/pdf   body: { mode, from, to }
const downloadClientBillingPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const mode = BILLING_MODES.has(req.body.mode) ? req.body.mode : "current";
    const from = req.body.from || "";
    const to = req.body.to || "";

    const client = await Client.findById(id).lean();
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    let tickets = await collectBillingTickets(id, mode, from, to);
    if (tickets.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No completed & finalised tickets match this billing scope.",
      });
    }

    // "Current" bills unbilled work — claim each ticket atomically (rather
    // than building the PDF first and marking isPdf afterward) so two
    // near-simultaneous downloads can never both bill the same ticket. A
    // ticket another request claims in the meantime (findOneAndUpdate
    // returns null here) is dropped from THIS statement instead of being
    // invoiced twice.
    if (mode === "current") {
      const claimed = [];
      for (const t of tickets) {
        const won = await Ticket.findOneAndUpdate(
          { _id: t._id, isPdf: { $ne: true } },
          { $set: { isPdf: true } },
        ).lean();
        if (won) claimed.push(won);
      }
      tickets = claimed;
      if (tickets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "This work was just billed in another request — nothing new to invoice.",
        });
      }
    }

    const { rows, summary } = await buildBillingPayload(client, tickets, mode);
    const pdf = await buildClientInvoicePdf({
      client,
      tickets: rows,
      summary,
      mode,
      from,
      to,
    });

    const safeName = String(client.name || "client").replace(/[^a-z0-9]+/gi, "-");
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="NirvanaHouse-${safeName}-${mode}-${stamp}.pdf"`,
    );
    return res.send(pdf);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Upload / replace a client's photo. Multer has already written the file by the
// time we get here — record its path and delete the one it replaces.
const uploadClientImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded." });
    }

    const client = await Client.findById(req.params.id).select("image");
    if (!client) {
      removeUploadedFile(`uploads/client/${req.file.filename}`);
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const previous = client.image;
    client.image = `uploads/client/${req.file.filename}`;
    await client.save();

    if (previous && previous !== client.image) {
      removeUploadedFile(previous);
    }

    // Image-only patch — a distinct event from client-updated/created so the
    // frontend listener can merge just this field instead of replacing the
    // whole row (this payload has no totalWorkAmount/paidAmount/balanceDue).
    emitScopedEvent(
      "client-image",
      { _id: String(client._id), image: client.image },
      { permission: "clients.view" },
    );

    return res.status(200).json({
      success: true,
      message: "Client photo updated",
      data: { _id: String(client._id), image: client.image },
    });
  } catch (error) {
    // DB write failed — don't leave the just-uploaded file orphaned on disk.
    if (req.file && req.file.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Remove a client's photo (clears the field and deletes the file).
const deleteClientImage = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select("image");
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const previous = client.image;
    client.image = "";
    await client.save();

    if (previous) removeUploadedFile(previous);

    emitScopedEvent("client-image", { _id: String(client._id), image: "" }, { permission: "clients.view" });

    return res.status(200).json({
      success: true,
      message: "Client photo removed",
      data: { _id: String(client._id), image: "" },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getClient,
  getClientById,
  getClientStats,
  getClientPayments,
  postClient,
  updateClient,
  deleteClient,
  reactivateClient,
  getClientBilling,
  downloadClientBillingPdf,
  uploadClientImage,
  deleteClientImage,
  enrichClient,
};
