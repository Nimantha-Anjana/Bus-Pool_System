const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const AssignmentActionToken = sequelize.define(
  "AssignmentActionToken",
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
    recipientEmail: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "recipient_email",
    },
    tokenHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: "token_hash",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "used_at",
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "revoked_at",
    },
  },
  {
    tableName: "assignment_action_tokens",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = AssignmentActionToken;