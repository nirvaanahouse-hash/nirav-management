const { validateBody } = require("../middleware/validate.middleware");

const createAmountSchema = {
  recipient: { required: true, label: "Recipient" },
  recipientType: {
    required: true,
    label: "Recipient type",
    enum: ["employee", "client"],
  },
  type: { required: true, label: "Entry type", enum: ["received", "sent"] },
  amount: { required: true, label: "Amount", type: "number", min: 0.01 },
  description: { required: false, label: "Description", maxLength: 300 },
};

const updateAmountSchema = {
  amount: { required: false, label: "Amount", type: "number", min: 0.01 },
  description: { required: false, label: "Description", maxLength: 300 },
};

module.exports = {
  validateCreateAmount: validateBody(createAmountSchema),
  validateUpdateAmount: validateBody(updateAmountSchema),
};
