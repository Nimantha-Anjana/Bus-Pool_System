const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const AssignmentResponse = sequelize.define(
  "AssignmentResponse",
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
    responderType: {
      type: DataTypes.ENUM("owner", "driver"),
      allowNull: false,
      field: "responder_type",
    },
    responderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "responder_id",
    },
    response: {
      type: DataTypes.ENUM("accepted", "rejected"),
      allowNull: false,
    },
    reason: DataTypes.TEXT,
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "responded_at",
    },
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
    tableName: "assignment_responses",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = AssignmentResponse;