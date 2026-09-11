const { BADGE_VARIANTS } = require("../constants");
const { validateBody } = require("../middleware/validate.middleware");

const validateCreateTicketType = validateBody({
  label: { required: true, label: "Type name", minLength: 2, maxLength: 40 },
  variant: { required: false, label: "Colour", enum: BADGE_VARIANTS },
  isJob: { required: false, label: "Hour-wise pricing", type: "boolean" },
  isActive: { required: false, label: "Active", type: "boolean" },
});

// `key` and `isJob` are fixed once tickets can reference them, so an update
// only ever touches presentation.
const validateUpdateTicketType = validateBody({
  label: { required: false, label: "Type name", minLength: 2, maxLength: 40 },
  variant: { required: false, label: "Colour", enum: BADGE_VARIANTS },
  isActive: { required: false, label: "Active", type: "boolean" },
  sortOrder: { required: false, label: "Order", type: "number", min: 0, max: 999 },
});

module.exports = { validateCreateTicketType, validateUpdateTicketType };
