const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal server error."
        : error.message || "Something went wrong.",
  });
};

module.exports = errorHandler;