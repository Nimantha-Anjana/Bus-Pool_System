const { sequelize } = require("../config/database");

// Error that the central error handler turns into a JSON response with this status code
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Run `work(transaction)`; commit on success, roll back on any error
const withTransaction = async (work) => {
  const transaction = await sequelize.transaction();

  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
};

module.exports = { HttpError, withTransaction };
