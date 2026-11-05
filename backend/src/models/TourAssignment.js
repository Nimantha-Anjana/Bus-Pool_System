const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TourAssignment = sequelize.define(
  "TourAssignment",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    tourId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "tour_id",
    },
    busId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "bus_id",
    },
    driverId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "driver_id",
    },
    ownerId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "owner_id",
    },
    assignedStartAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "assigned_start_at",
    },
    assignedEndAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "assigned_end_at",
    },
    ownerStatus: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      field: "owner_status",
    },
    driverStatus: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      allowNull: false,
      defaultValue: "pending",
      field: "driver_status",
    },
    assignmentStatus: {
      type: DataTypes.ENUM(
        "pending",
        "confirmed",
        "rejected",
        "cancelled",
        "completed"
      ),
      allowNull: false,
      defaultValue: "pending",
      field: "assignment_status",
    },
    assignedBy: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "assigned_by",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "confirmed_at",
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "started_at",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "completed_at",
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "cancelled_at",
    },
  },
  {
    tableName: "tour_assignments",
    timestamps: true,
    underscored: true,
  }
);

module.exports = TourAssignment;