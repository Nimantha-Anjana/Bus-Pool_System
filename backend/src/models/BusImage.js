const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const BusImage = sequelize.define(
  "BusImage",
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
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "file_name",
    },
    imageUrl: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "image_url",
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "original_name",
    },
    mimeType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "mime_type",
    },
    fileSize: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "file_size",
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_primary",
    },
  },
  {
    tableName: "bus_images",
    timestamps: true,
    underscored: true,
  }
);

module.exports = BusImage;
