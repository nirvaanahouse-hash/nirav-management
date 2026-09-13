const { runSchema, validationFailed, MONGO_ID_RE } = require("../utils/validate");

function validateBody(schema) {
  return (req, res, next) => {
    const errors = runSchema(schema, req.body);
    if (errors.length) {
      return validationFailed(res, errors);
    }
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const errors = runSchema(schema, req.params);
    if (errors.length) {
      return validationFailed(res, errors);
    }
    next();
  };
}

const mongoIdParam = validateParams({
  id: { required: true, mongoId: true, label: "ID" },
});

function validateCustom(fn) {
  return (req, res, next) => {
    const errors = fn(req) || [];
    if (errors.length) {
      return validationFailed(res, errors);
    }
    next();
  };
}

function isMongoId(value) {
  return typeof value === "string" && MONGO_ID_RE.test(value);
}

module.exports = {
  validateBody,
  validateParams,
  validateCustom,
  mongoIdParam,
  isMongoId,
};
