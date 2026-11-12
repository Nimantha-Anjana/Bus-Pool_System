const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TourStop = sequelize.define(
  "TourStop",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tourId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "tour_id",
    },
    stopName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "stop_name",
    },
    stopType: {
      type: DataTypes.ENUM("pickup", "stop", "drop"),
      allowNull: false,
      defaultValue: "stop",
      field: "stop_type",
    },
    locationAddress: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "location_address",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    stopOrder: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      field: "stop_order",
    },
    plannedArrivalAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "planned_arrival_at",
    },
    notes: DataTypes.TEXT,
  },
  {
    tableName: "tour_stops",
    timestamps: true,
    underscored: true,
  }
);

module.exports = TourStop;