const Role = require("./Role");
const User = require("./User");
const BusOwner = require("./BusOwner");
const Driver = require("./Driver");
const Bus = require("./Bus");
const Tour = require("./Tour");
const TourStop = require("./TourStop");
const TourAssignment = require("./TourAssignment");
const AssignmentResponse = require("./AssignmentResponse");
const AssignmentActionToken = require("./AssignmentActionToken");
const Notification = require("./Notification");
const EmailLog = require("./EmailLog");
const GpsLocation = require("./GpsLocation");
const ActivityLog = require("./ActivityLog");
const RefreshToken = require("./RefreshToken");

// ROLE ↔ USER
Role.hasMany(User, {
  foreignKey: "roleId",
  as: "users",
});

User.belongsTo(Role, {
  foreignKey: "roleId",
  as: "role",
});

// USER ↔ DRIVER
User.hasOne(Driver, {
  foreignKey: "userId",
  as: "driver",
});

Driver.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// BUS OWNER ↔ BUS
BusOwner.hasMany(Bus, {
  foreignKey: "ownerId",
  as: "buses",
});

Bus.belongsTo(BusOwner, {
  foreignKey: "ownerId",
  as: "owner",
});

// USER ↔ TOUR (creator)
User.hasMany(Tour, {
  foreignKey: "createdBy",
  as: "createdTours",
});

Tour.belongsTo(User, {
  foreignKey: "createdBy",
  as: "creator",
});

// TOUR ↔ TOUR STOP
Tour.hasMany(TourStop, {
  foreignKey: "tourId",
  as: "stops",
});

TourStop.belongsTo(Tour, {
  foreignKey: "tourId",
  as: "tour",
});

// TOUR ↔ TOUR ASSIGNMENT
Tour.hasMany(TourAssignment, {
  foreignKey: "tourId",
  as: "assignments",
});

TourAssignment.belongsTo(Tour, {
  foreignKey: "tourId",
  as: "tour",
});

// BUS ↔ TOUR ASSIGNMENT
Bus.hasMany(TourAssignment, {
  foreignKey: "busId",
  as: "assignments",
});

TourAssignment.belongsTo(Bus, {
  foreignKey: "busId",
  as: "bus",
});

// DRIVER ↔ TOUR ASSIGNMENT
Driver.hasMany(TourAssignment, {
  foreignKey: "driverId",
  as: "assignments",
});

TourAssignment.belongsTo(Driver, {
  foreignKey: "driverId",
  as: "driver",
});

// OWNER ↔ TOUR ASSIGNMENT
BusOwner.hasMany(TourAssignment, {
  foreignKey: "ownerId",
  as: "assignments",
});

TourAssignment.belongsTo(BusOwner, {
  foreignKey: "ownerId",
  as: "owner",
});

// ADMIN USER ↔ TOUR ASSIGNMENT
User.hasMany(TourAssignment, {
  foreignKey: "assignedBy",
  as: "assignedTours",
});

TourAssignment.belongsTo(User, {
  foreignKey: "assignedBy",
  as: "assignedByUser",
});

// ASSIGNMENT ↔ RESPONSES
TourAssignment.hasMany(AssignmentResponse, {
  foreignKey: "assignmentId",
  as: "responses",
});

AssignmentResponse.belongsTo(TourAssignment, {
  foreignKey: "assignmentId",
  as: "assignment",
});

// ASSIGNMENT ↔ ACTION TOKENS
TourAssignment.hasMany(AssignmentActionToken, {
  foreignKey: "assignmentId",
  as: "actionTokens",
});

AssignmentActionToken.belongsTo(TourAssignment, {
  foreignKey: "assignmentId",
  as: "assignment",
});

// USER ↔ NOTIFICATIONS
User.hasMany(Notification, {
  foreignKey: "userId",
  as: "notifications",
});

Notification.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// ASSIGNMENT ↔ EMAIL LOGS
TourAssignment.hasMany(EmailLog, {
  foreignKey: "assignmentId",
  as: "emailLogs",
});

EmailLog.belongsTo(TourAssignment, {
  foreignKey: "assignmentId",
  as: "assignment",
});

// ASSIGNMENT ↔ GPS LOCATIONS
TourAssignment.hasMany(GpsLocation, {
  foreignKey: "assignmentId",
  as: "gpsLocations",
});

GpsLocation.belongsTo(TourAssignment, {
  foreignKey: "assignmentId",
  as: "assignment",
});

// USER ↔ ACTIVITY LOGS
User.hasMany(ActivityLog, {
  foreignKey: "userId",
  as: "activityLogs",
});

ActivityLog.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// USER ↔ REFRESH TOKENS
User.hasMany(RefreshToken, {
  foreignKey: "userId",
  as: "refreshTokens",
});

RefreshToken.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

module.exports = {
  Role,
  User,
  BusOwner,
  Driver,
  Bus,
  Tour,
  TourStop,
  TourAssignment,
  AssignmentResponse,
  AssignmentActionToken,
  Notification,
  EmailLog,
  GpsLocation,
  ActivityLog,
  RefreshToken,
};