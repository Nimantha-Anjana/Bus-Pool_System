const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Driver = sequelize.define(
  "Driver",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: "user_id",
    },
    nic: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    licenseNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: "license_number",
    },
    licenseExpiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "license_expiry_date",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "profile_image",
    },
    emergencyContactName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "emergency_contact_name",
    },
    emergencyContactPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "emergency_contact_phone",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "drivers",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Driver;