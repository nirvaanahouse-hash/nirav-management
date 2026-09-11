const { PRIORITY_VALUES, TICKET_STATUS_VALUES, ERole } = require("../constants");
const { runSchema } = require("../utils/validate");
const { validateBody } = require("../middleware/validate.middleware");

function validateCreateTicket(req) {
  const isSA = req.user?.role === ERole.SA;
  const body = req.body || {};
  // Types come from the SA-managed registry, loaded by attachTicketTypes().
  const typeKeys = req.ticketTypeKeys || [];
  const isJobType = !!req.ticketTypeMap?.[body.ticketType]?.isJob;

  const schema = {
    coupleName: { required: true, label: "Couple name", minLength: 2 },
    ticketType: { required: true, label: "Ticket type", enum: typeKeys },
    priorety: { required: true, label: "Priority", enum: PRIORITY_VALUES },
    // Hour fields only apply to job-type tickets.
    HR: { required: isJobType, label: "Work hours", type: "number", min: 0 },
    deleveryDate: { required: true, label: "Delivery date" },
    status: { required: false, label: "Status", enum: TICKET_STATUS_VALUES },
    remark: { required: false, label: "Remark", maxLength: 500 },
  };

  if (isSA) {
    schema.client = { required: true, label: "Client" };
    schema.assignedEmployee = { required: true, label: "Assigned employee" };
    schema.userPersentage = {
      required: true,
      label: "User percentage",
      type: "number",
      min: 0,
      max: 100,
    };
    schema.amount = { required: true, label: "User amount", type: "number", min: 0 };
    schema.mainAmount = { required: true, label: "Main amount", type: "number", min: 0 };
    schema.hrPrice = { required: isJobType, label: "HR price", type: "number", min: 0 };
    schema.mainHr = { required: isJobType, label: "Main hours", type: "number", min: 0 };
  }

  return runSchema(schema, body);
}

function validateUpdateTicket(req) {
  const body = req.body || {};
  const typeKeys = req.ticketTypeKeys || [];
  const schema = {
    coupleName: { required: false, label: "Couple name", minLength: 2 },
    ticketType: { required: false, label: "Ticket type", enum: typeKeys },
    priorety: { required: false, label: "Priority", enum: PRIORITY_VALUES },
    HR: { required: false, label: "Work hours", type: "number", min: 0 },
    mainHr: { required: false, label: "Main hours", type: "number", min: 0 },
    hrPrice: { required: false, label: "HR price", type: "number", min: 0 },
    userPersentage: {
      required: false,
      label: "User percentage",
      type: "number",
      min: 0,
      max: 100,
    },
    status: { required: false, label: "Status", enum: TICKET_STATUS_VALUES },
    remark: { required: false, label: "Remark", maxLength: 500 },
    deleveryDate: { required: false, label: "Delivery date" },
  };

  return runSchema(schema, body);
}

const validateAssignEmployee = validateBody({
  assignedEmployee: { required: false, label: "Assigned employee" },
});

const validateComment = validateBody({
  text: { required: true, label: "Comment", minLength: 1, maxLength: 1000 },
});

module.exports = {
  validateCreateTicket,
  validateUpdateTicket,
  validateAssignEmployee,
  validateComment,
};
