const { validateBody } = require("../middleware/validate.middleware");

const statusSchema = {
  isActive: { required: true, label: "Active status", type: "boolean" },
};

module.exports = {
  validateEmployeeStatus: validateBody(statusSchema),
};
