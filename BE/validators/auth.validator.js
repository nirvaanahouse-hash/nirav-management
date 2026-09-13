const { validateBody } = require("../middleware/validate.middleware");

const registerSchema = {
  firstName: { required: true, label: "First name", minLength: 1, maxLength: 50 },
  lastName: { required: false, label: "Last name", maxLength: 50 },
  userName: { required: true, label: "Username", minLength: 3, maxLength: 20 },
  email: { required: true, label: "Email", email: true },
  password: { required: true, label: "Password", minLength: 6 },
  mobileNumber: { required: true, label: "Mobile number", mobile: true },
};

const loginSchema = {
  email: { required: true, label: "Email or username", minLength: 1 },
  password: { required: true, label: "Password", minLength: 6 },
};

module.exports = {
  validateRegister: validateBody(registerSchema),
  validateLogin: validateBody(loginSchema),
};
