const express = require("express");
const { sequelize } = require("../config/database");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    await sequelize.authenticate();

    return res.status(200).json({
      success: true,
      message: "Bus Pool System API is running successfully.",
      data: {
        api: "healthy",
        database: "connected",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;