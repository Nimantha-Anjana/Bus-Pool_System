const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const GpsLocation = sequelize.define(
  "GpsLocation",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    assignmentId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "assignment_id",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    accuracy: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    speed: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    heading: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "recorded_at",
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "received_at",
    },
  },
  {
    tableName: "gps_locations",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = GpsLocation;