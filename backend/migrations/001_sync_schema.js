// Brings an older database (e.g. the phpMyAdmin dump) up to what the code expects.
// Idempotent: every step checks whether it is already done.
const { DriverDocument, BusImage, BusFacility } = require("../src/models");

const hasColumn = async (sequelize, table, column) => {
  const columns = await sequelize.getQueryInterface().describeTable(table);
  return Boolean(columns[column]);
};

module.exports = {
  name: "001_sync_schema",
  async up(sequelize) {
    if (!(await hasColumn(sequelize, "users", "token_version"))) {
      await sequelize.query(
        "ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER status"
      );
      console.log("users.token_version added.");
    } else {
      console.log("users.token_version already exists.");
    }

    if (!(await hasColumn(sequelize, "tour_stops", "stop_type"))) {
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


  },
};
