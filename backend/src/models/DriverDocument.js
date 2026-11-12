const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const DriverDocument = sequelize.define(
  "DriverDocument",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    driverId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "driver_id",
    },
    documentType: {
      type: DataTypes.ENUM("nic", "license"),
      allowNull: false,
      field: "document_type",
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "file_name",
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "original_name",
    },
    mimeType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "mime_type",
    },
    fileSize: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "file_size",
    },
    uploadedBy: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "uploaded_by",
    },
  },
  {
    tableName: "driver_documents",
    timestamps: true,
    underscored: true,
  }
);

module.exports = DriverDocument;
