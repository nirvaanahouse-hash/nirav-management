const { validateBody } = require("../middleware/validate.middleware");

const clientStatus = ["active", "inactive", "pending"];

const createClientSchema = {
  name: { required: true, label: "Full name", minLength: 2, maxLength: 80 },
  sortName: { required: true, label: "Sort name", minLength: 1, maxLength: 40 },
  company: { required: false, label: "Company", maxLength: 80 },
  email: { required: false, label: "Email", email: true },
  phone: { required: true, label: "Phone", phone: true },
  mobileNumber: { required: true, label: "Mobile number", mobile: true },
  status: { required: false, label: "Status", enum: clientStatus },
};

const updateClientSchema = {
  name: { required: false, label: "Full name", minLength: 2, maxLength: 80 },
  sortName: { required: false, label: "Sort name", minLength: 1, maxLength: 40 },
  company: { required: false, label: "Company", maxLength: 80 },
  email: { required: false, label: "Email", email: true },
  phone: { required: false, label: "Phone", phone: true },
  mobileNumber: { required: false, label: "Mobile number", mobile: true },
  status: { required: false, label: "Status", enum: clientStatus },
};

module.exports = {
  validateCreateClient: validateBody(createClientSchema),
  validateUpdateClient: validateBody(updateClientSchema),
};
