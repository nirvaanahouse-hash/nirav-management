function formatMongooseErrors(error) {
  if (error.name === "ValidationError" && error.errors) {
    return Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "field";
    return [{ field, message: `${field} already exists.` }];
  }

  if (error.name === "CastError") {
    return [{ field: error.path || "id", message: "Invalid ID." }];
  }

  return [{ field: "_", message: error.message || "Something went wrong." }];
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const mongooseLike =
    error.name === "ValidationError" ||
    error.name === "CastError" ||
    error.code === 11000;

  const errors = formatMongooseErrors(error);
  // Honour an explicit status (e.g. 404 from express.static with fallthrough:false).
  const explicitStatus = Number(error.status || error.statusCode) || 0;
  const status = explicitStatus || (mongooseLike ? 400 : 500);

  return res.status(status).json({
    success: false,
    message: errors[0]?.message || "Request failed.",
    errors,
  });
}

module.exports = errorHandler;
