const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ActivityLog = sequelize.define(
  "ActivityLog",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "user_id",
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "entity_type",
    },
    entityId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "entity_id",
    },
    description: DataTypes.TEXT,
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: "ip_address",
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "user_agent",
    },
  },
  {
    tableName: "activity_logs",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = ActivityLog;