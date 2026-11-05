const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "user_id",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    notificationType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "notification_type",
    },
    relatedType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "related_type",
    },
    relatedId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "related_id",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_read",
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "read_at",
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = Notification;