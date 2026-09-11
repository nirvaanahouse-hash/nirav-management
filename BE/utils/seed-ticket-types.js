const TicketType = require("../models/ticketType.model");
const { TICKET_TYPES, TICKET_TYPE_VARIANTS } = require("../constants");
const { invalidateTicketTypeCache } = require("./ticket-types");

/**
 * First-boot seed only: copies the original hard-coded TICKET_TYPES into the
 * collection so existing tickets keep their labels. It runs only while the
 * collection is empty, so a type an SA deletes never comes back.
 */
async function seedTicketTypes() {
  try {
    const existing = await TicketType.estimatedDocumentCount();
    if (existing > 0) {
      return;
    }

    const docs = Object.entries(TICKET_TYPES).map(([key, label], index) => ({
      key,
      label,
      variant: TICKET_TYPE_VARIANTS[key] || "neutral",
      isJob: key.endsWith("Job"),
      isActive: true,
      sortOrder: index,
    }));

    await TicketType.insertMany(docs);
    invalidateTicketTypeCache();
    console.log(`🎫 Ticket types seeded: ${docs.length} built-in type(s)`);
  } catch (error) {
    console.log("⚠️  Ticket type seed skipped:", error.message);
  }
}

module.exports = { seedTicketTypes };
