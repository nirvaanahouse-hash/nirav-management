const { validateBody, validateCustom } = require("../middleware/validate.middleware");
const { runSchema } = require("../utils/validate");
const { isValidIpOrCidr } = require("../utils/ip");
const { IP_RULE_MODE_VALUES } = require("../constants");

const createRuleSchema = {
  ip: { required: true, label: "IP address", maxLength: 60 },
  mode: { required: true, label: "Mode", enum: IP_RULE_MODE_VALUES },
  note: { required: false, label: "Note", maxLength: 160 },
};

const updateRuleSchema = {
  ip: { required: false, label: "IP address", maxLength: 60 },
  mode: { required: false, label: "Mode", enum: IP_RULE_MODE_VALUES },
  note: { required: false, label: "Note", maxLength: 160 },
  isActive: { required: false, label: "Active", type: "boolean" },
};

function checkIpFormat(errors, value) {
  const raw = value === undefined || value === null ? "" : String(value).trim();
  if (raw === "") return errors; // "required" handled by the schema
  if (errors.some((e) => e.field === "ip")) return errors;
  if (!isValidIpOrCidr(raw)) {
    errors.push({
      field: "ip",
      message: "Enter a valid IPv4/IPv6 address or an IPv4 CIDR block (e.g. 192.168.1.0/24).",
    });
  }
  return errors;
}

const validateCreateIpRule = validateCustom((req) =>
  checkIpFormat(runSchema(createRuleSchema, req.body), req.body.ip),
);

const validateUpdateIpRule = validateCustom((req) => {
  const errors = runSchema(updateRuleSchema, req.body);
  if (req.body.ip !== undefined) checkIpFormat(errors, req.body.ip);
  return errors;
});

const ipSettingsSchema = {
  guardEnabled: { required: false, label: "Guard enabled", type: "boolean" },
  rateLimitEnabled: { required: false, label: "Rate limiting enabled", type: "boolean" },
  rateLimitWindowMs: { required: false, label: "Rate limit window (ms)", min: 1000, max: 3600000 },
  rateLimitMax: { required: false, label: "Requests per window", min: 0, max: 100000 },
  authRateLimitMax: { required: false, label: "Login attempts per window", min: 0, max: 100000 },
  logRequests: { required: false, label: "Log requests", type: "boolean" },
};

const validateIpSettings = validateBody(ipSettingsSchema);

module.exports = {
  validateCreateIpRule,
  validateUpdateIpRule,
  validateIpSettings,
};
