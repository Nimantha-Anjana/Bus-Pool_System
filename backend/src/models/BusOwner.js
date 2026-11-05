const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const BusOwner = sequelize.define(
  "BusOwner",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    ownerName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "owner_name",
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    nic: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    businessRegistrationNo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      field: "business_registration_no",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "bus_owners",
    timestamps: true,
    underscored: true,
  }
);

module.exports = BusOwner;