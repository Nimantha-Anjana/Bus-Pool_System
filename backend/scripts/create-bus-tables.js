require("dotenv").config();

const { sequelize } = require("../src/config/database");
const { BusImage, BusFacility } = require("../src/models");

(async () => {
  try {
    await sequelize.authenticate();
    await BusImage.sync();
    await BusFacility.sync();
    console.log("bus_images and bus_facilities tables are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
})();
