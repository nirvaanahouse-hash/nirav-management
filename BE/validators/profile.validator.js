const { validateBody } = require("../middleware/validate.middleware");

const updateProfileSchema = {
  firstName: { required: false, label: "First name", minLength: 1, maxLength: 50 },
  lastName: { required: false, label: "Last name", maxLength: 50 },
  userName: { required: false, label: "Username", minLength: 3, maxLength: 20 },
  email: { required: false, label: "Email", email: true },
  mobileNumber: { required: false, label: "Mobile number", mobile: true },
  gender: { required: false, label: "Gender", enum: ["male", "female", "other"] },
  homeAddress: { required: false, label: "Address", minLength: 5, maxLength: 200 },
  dob: { required: false, label: "Date of birth" },
  percentage: { required: false, label: "Percentage", type: "number", min: 0, max: 100 },
};

module.exports = {
  validateUpdateProfile: validateBody(updateProfileSchema),
};
