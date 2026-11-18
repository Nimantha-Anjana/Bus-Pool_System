// One-shot, SAFE-TO-RE-RUN migration that brings an older database (for example the phpMyAdmin dump
// `bus_pool_system.sql`) up to what the code expects:
//
//   users.token_version          (logout-from-all-devices / token invalidation)
//   tour_stops.stop_type         (pickup / stop / drop)
//   driver_documents table       (NIC / licence scans)
//   bus_images table             (bus photos)
//   bus_facilities table         (bus facilities list)
//
// Nothing is dropped or overwritten; every step first checks whether it is already done.
//
//   npm run db:migrate
require("dotenv").config();

const { sequelize } = require("../src/config/database");
const { DriverDocument, BusImage, BusFacility } = require("../src/models");

const hasColumn = async (table, column) => {
  const columns = await sequelize.getQueryInterface().describeTable(table);
  return Boolean(columns[column]);
};

(async () => {
  try {
    await sequelize.authenticate();

    if (!(await hasColumn("users", "token_version"))) {
      await sequelize.query(
        "ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER status"
      );
      console.log("users.token_version added.");
    } else {
      console.log("users.token_version already exists.");
    }

    if (!(await hasColumn("tour_stops", "stop_type"))) {
      await sequelize.query(
        "ALTER TABLE tour_stops ADD COLUMN stop_type ENUM('pickup','stop','drop') NOT NULL DEFAULT 'stop' AFTER stop_name"
      );
      console.log("tour_stops.stop_type added.");
    } else {
      console.log("tour_stops.stop_type already exists.");
    }

    // sync() only creates a table when it is missing (it never alters or drops an existing one)
    await BusImage.sync();
    await BusFacility.sync();
    await DriverDocument.sync();
    console.log("bus_images, bus_facilities and driver_documents tables are ready.");

    // Existing buses: copy the old JSON `facilities` column into bus_facilities (only for buses that have none yet)
    const [rows] = await sequelize.query(
      `SELECT b.id, b.facilities FROM buses b
       WHERE b.facilities IS NOT NULL AND JSON_LENGTH(b.facilities) > 0
         AND NOT EXISTS (SELECT 1 FROM bus_facilities f WHERE f.bus_id = b.id)`
    );

    let copied = 0;
    for (const row of rows) {
      let list = [];
      try {
        list = typeof row.facilities === "string" ? JSON.parse(row.facilities) : row.facilities;
      } catch {
        list = [];
      }

      const names = [...new Set((Array.isArray(list) ? list : []).map((v) => String(v).trim()).filter(Boolean))];
      if (names.length) {
        await BusFacility.bulkCreate(names.map((facilityName) => ({ busId: row.id, facilityName: facilityName.slice(0, 80) })));
        copied += 1;
      }
    }
    if (copied) console.log(`Facilities copied to bus_facilities for ${copied} bus(es).`);

    console.log("Schema migration finished.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
})();
