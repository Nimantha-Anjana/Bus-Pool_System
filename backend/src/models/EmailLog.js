const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EmailLog = sequelize.define(
  "EmailLog",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    assignmentId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "assignment_id",
    },
    recipientEmail: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "recipient_email",
    },
    emailType: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: "email_type",
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    deliveryStatus: {
      type: DataTypes.ENUM("pending", "sent", "failed"),
      allowNull: false,
      defaultValue: "pending",
      field: "delivery_status",
    },
    providerMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "provider_message_id",
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "error_message",
    },
    attempts: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "sent_at",
    },
  },
  {
    tableName: "email_logs",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = EmailLog;