const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\d{10}$/;
const PHONE_RE = /^[0-9+\-\s]{7,15}$/;
const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function asString(value) {
  return typeof value === "string" ? value.trim() : String(value);
}

function runSchema(schema, data = {}) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const label = rules.label || field;
    const value = data[field];

    if (rules.required && isEmpty(value)) {
      errors.push({ field, message: `${label} is required.` });
      continue;
    }

    if (isEmpty(value)) {
      continue;
    }

    if (rules.type === "number" || rules.min !== undefined || rules.max !== undefined) {
      const num = Number(value);
      if (Number.isNaN(num)) {
        errors.push({ field, message: `${label} must be a number.` });
        continue;
      }
      if (rules.min !== undefined && num < rules.min) {
        errors.push({ field, message: `${label} must be at least ${rules.min}.` });
      }
      if (rules.max !== undefined && num > rules.max) {
        errors.push({ field, message: `${label} must be at most ${rules.max}.` });
      }
    }

    if (rules.type === "boolean" && typeof value !== "boolean") {
      if (value !== "true" && value !== "false") {
        errors.push({ field, message: `${label} must be true or false.` });
      }
    }

    if (rules.minLength && asString(value).length < rules.minLength) {
      errors.push({
        field,
        message: `${label} must be at least ${rules.minLength} characters.`,
      });
    }

    if (rules.maxLength && asString(value).length > rules.maxLength) {
      errors.push({
        field,
        message: `${label} must be at most ${rules.maxLength} characters.`,
      });
    }

    if (rules.email && !EMAIL_RE.test(asString(value))) {
      errors.push({ field, message: "Enter a valid email address." });
    }

    if (rules.mobile && !MOBILE_RE.test(asString(value))) {
      errors.push({ field, message: `${label} must be a 10-digit number.` });
    }

    if (rules.phone && !PHONE_RE.test(asString(value))) {
      errors.push({ field, message: `${label} format is invalid.` });
    }

    if (rules.mongoId && !MONGO_ID_RE.test(asString(value))) {
      errors.push({ field, message: `${label} is invalid.` });
    }

    if (rules.pattern && !rules.pattern.test(asString(value))) {
      errors.push({ field, message: rules.message || `${label} format is invalid.` });
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field,
        message: `${label} must be one of: ${rules.enum.join(", ")}.`,
      });
    }
  }

  return errors;
}

function validationFailed(res, errors, message) {
  return res.status(400).json({
    success: false,
    message: message || errors[0]?.message || "Validation failed.",
    errors,
  });
}

module.exports = {
  EMAIL_RE,
  MOBILE_RE,
  PHONE_RE,
  MONGO_ID_RE,
  isEmpty,
  runSchema,
  validationFailed,
};
