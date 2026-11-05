const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Tour = sequelize.define(
  "Tour",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tourCode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      field: "tour_code",
    },
    tourName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "tour_name",
    },
    tourType: {
      type: DataTypes.ENUM("local", "foreign"),
      allowNull: false,
      defaultValue: "local",
      field: "tour_type",
    },
    description: DataTypes.TEXT,
    startLocation: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "start_location",
    },
    destination: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "start_at",
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "end_at",
    },
    pickupAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "pickup_at",
    },
    returnAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "return_at",
    },
    passengerCount: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      field: "passenger_count",
    },
    status: {
      type: DataTypes.ENUM(
        "planned",
        "ongoing",
        "completed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "planned",
    },
    specialNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "special_notes",
    },
    createdBy: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "created_by",
    },
  },
  {
    tableName: "tours",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Tour;