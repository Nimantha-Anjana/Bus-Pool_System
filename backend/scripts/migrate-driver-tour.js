require("dotenv").config();

const { sequelize } = require("../src/config/database");
const { DriverDocument } = require("../src/models");

(async () => {
  try {
    await sequelize.authenticate();

    // 1. driver_documents table
    await DriverDocument.sync();
    console.log("driver_documents table is ready.");

    // 2. tour_stops.stop_type column (only added when missing)
    const columns = await sequelize.getQueryInterface().describeTable("tour_stops");
    if (!columns.stop_type) {
      await sequelize.query(
        "ALTER TABLE tour_stops ADD COLUMN stop_type ENUM('pickup','stop','drop') NOT NULL DEFAULT 'stop' AFTER stop_name"
      );
      console.log("tour_stops.stop_type column added.");
    } else {
      console.log("tour_stops.stop_type already exists.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
})();
