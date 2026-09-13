const express = require("express");
const router = express.Router();

const { requirePermission } = require("../middleware/permission.middleware");
const { mongoIdParam } = require("../middleware/validate.middleware");
const {
  listTicketTypes,
  getTicketTypeById,
  createTicketType,
  updateTicketType,
  deleteTicketType,
} = require("../controllers/ticketType.controller");
const {
  validateCreateTicketType,
  validateUpdateTicketType,
} = require("../validators/ticketType.validator");

// The registry is SA territory (SA bypasses the permission check entirely).
// Everyone else reads the active types through GET /api/ticket/form-meta.
router.use("/ticket-type", requirePermission("tickets.types.manage"));

router.get("/ticket-type", listTicketTypes);
router.get("/ticket-type/:id", mongoIdParam, getTicketTypeById);
router.post("/ticket-type", validateCreateTicketType, createTicketType);
router.put("/ticket-type/:id", mongoIdParam, validateUpdateTicketType, updateTicketType);
router.patch("/ticket-type/:id", mongoIdParam, validateUpdateTicketType, updateTicketType);
router.delete("/ticket-type/:id", mongoIdParam, deleteTicketType);

module.exports = router;
