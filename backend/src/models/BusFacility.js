const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const BusFacility = sequelize.define(
  "BusFacility",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    busId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "bus_id",
    },
    facilityName: {
      type: DataTypes.STRING(80),
      allowNull: false,
      field: "facility_name",
    },
  },
  {
    tableName: "bus_facilities",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        name: "uq_bus_facility",
        fields: ["bus_id", "facility_name"],
      },
    ],
  }
);

module.exports = BusFacility;
