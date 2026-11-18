const { reportError } = require("../utils/error-reporter");

// Translate well-known library errors into proper HTTP status codes
// (so a duplicate row is a 409 and a bad JSON body is a 400 instead of a generic 500).
const resolveStatus = (error) => {
  // body-parser errors carry BOTH `status` and `statusCode`, so recognise them by type first
  if (error.type === "entity.parse.failed")
    return { statusCode: 400, message: "Request body contains invalid JSON." };
  if (error.type === "entity.too.large")
    return { statusCode: 413, message: "Request body is too large." };

  // Errors we raised ourselves (HttpError / error.statusCode)
  if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600)
    return { statusCode: error.statusCode, message: error.message };

  // body-parser / http-errors use `status`
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return { statusCode: error.status, message: error.message };
  }

  switch (error.name) {
    case "SequelizeUniqueConstraintError":
      return { statusCode: 409, message: "A record with the same unique value already exists." };
    case "SequelizeForeignKeyConstraintError":
      return {
        statusCode: 409,
        message: "This action conflicts with related records (a referenced record is missing or still in use).",
      };
    case "SequelizeValidationError":
      return {
        statusCode: 400,
        message: error.errors?.[0]?.message || "Validation failed.",
      };
    case "SequelizeDatabaseError":
      // e.g. value too long / out of range / wrong type for a column
      if (["ER_DATA_TOO_LONG", "ER_WARN_DATA_OUT_OF_RANGE", "ER_TRUNCATED_WRONG_VALUE"].includes(error.parent?.code))
        return { statusCode: 400, message: "One of the submitted values is too long or invalid." };
      return { statusCode: 500, message: error.message };
    case "SequelizeConnectionError":
    case "SequelizeConnectionRefusedError":
    case "SequelizeHostNotFoundError":
    case "SequelizeConnectionAcquireTimeoutError":
      return { statusCode: 503, message: "The database is currently unavailable. Please try again shortly." };
    default:
      return { statusCode: 500, message: error.message };
  }
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const { statusCode, message } = resolveStatus(error);
  const isProduction = process.env.NODE_ENV === "production";

  // Always log server-side failures (also in production, otherwise nobody ever sees them)
  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ->`, error);
    reportError(error, `${req.method} ${req.originalUrl}`);
  } else if (!isProduction) {
    console.warn(`${req.method} ${req.originalUrl} -> ${statusCode} ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500 && isProduction ? "Internal server error." : message || "Something went wrong.",
  });
};

module.exports = errorHandler;
