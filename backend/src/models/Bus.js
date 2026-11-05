const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Bus = sequelize.define(
  "Bus",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    ownerId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "owner_id",
    },
    registrationNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      field: "registration_number",
    },
    busName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "bus_name",
    },
    busType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "bus_type",
    },
    seatingCapacity: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      field: "seating_capacity",
    },
    airConditioned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "air_conditioned",
    },
    imageUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "image_url",
    },
    facilities: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "available",
        "assigned",
        "maintenance",
        "inactive"
      ),
      allowNull: false,
      defaultValue: "available",
    },
  },
  {
    tableName: "buses",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Bus;