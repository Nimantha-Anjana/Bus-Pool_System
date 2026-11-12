const crypto = require("crypto");
const { Op } = require("sequelize");
const environment = require("../config/environment");
const {
  TourAssignment,
  Tour,
  Bus,
  BusOwner,
  Driver,
  User,
  AssignmentActionToken,
  AssignmentResponse,
} = require("../models");
const { hashToken } = require("../utils/token.utils");
const { HttpError } = require("../utils/transaction.util");
const { toDateOnly } = require("../utils/date.utils");

const ACTIVE_STATUSES = ["pending", "confirmed"];
const BUS_BLOCKED_STATUSES = ["maintenance", "inactive"];

// Everything an e-mail / API response needs about one assignment
const DETAIL_INCLUDES = [
  {
    model: Tour,
    as: "tour",
    attributes: ["id", "tourCode", "tourName", "status", "startAt", "endAt", "startLocation", "destination", "passengerCount"],
  },
  {
    model: Bus,
    as: "bus",
    attributes: ["id", "registrationNumber", "busName", "busType", "seatingCapacity", "status"],
  },
  {
    model: Driver,
    as: "driver",
    attributes: ["id", "nic", "licenseNumber", "status"],
    include: [{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email", "phone"] }],
  },
  { model: BusOwner, as: "owner", attributes: ["id", "ownerName", "email", "phone"] },
];

const loadDetail = (id, options = {}) =>
  TourAssignment.findByPk(id, { include: DETAIL_INCLUDES, ...options });

// Two periods overlap when each one starts before the other ends (touching ends do not overlap)
const overlapWhere = (start, end) => ({
  assignedStartAt: { [Op.lt]: end },
  assignedEndAt: { [Op.gt]: start },
});

const findConflicts = (column, id, start, end, excludeId, transaction) =>
  TourAssignment.findAll({
    where: {
      [column]: id,
      assignmentStatus: { [Op.in]: ACTIVE_STATUSES },
      ...overlapWhere(start, end),
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
    include: [{ model: Tour, as: "tour", attributes: ["id", "tourCode", "tourName"] }],
    transaction,
  });

const describeConflict = (who, conflicts) => {
  const first = conflicts[0];
  return `${who} is already assigned to tour ${first.tour.tourCode} (${first.tour.tourName}) during this period.`;
};

// Reasons a bus cannot take the job (empty array = available)
const busProblems = async (bus, owner, start, end, excludeId, transaction) => {
  const problems = [];

  if (BUS_BLOCKED_STATUSES.includes(bus.status)) problems.push(`Bus is ${bus.status}.`);
  if (owner.status !== "active") problems.push("The bus owner is inactive.");

  const conflicts = await findConflicts("busId", bus.id, start, end, excludeId, transaction);
  if (conflicts.length) problems.push(describeConflict("Bus", conflicts));

  return problems;
};

const driverProblems = async (driver, start, end, excludeId, transaction) => {
  const problems = [];

  if (driver.status !== "active") problems.push(`Driver is ${driver.status}.`);
  if (driver.user && driver.user.status !== "active") problems.push("The driver's login account is not active.");

  // licence must still be valid on the day the assignment ends
  if (driver.licenseExpiryDate < toDateOnly(end))
    problems.push("The driver's license expires before this assignment ends.");

  const conflicts = await findConflicts("driverId", driver.id, start, end, excludeId, transaction);
  if (conflicts.length) problems.push(describeConflict("Driver", conflicts));

  return problems;
};

// Validates tour/bus/driver/time window for a new or edited assignment.
// Locks the bus and driver rows (always in this order) so two admins cannot double-book at once.
const prepareAssignment = async ({ tourId, busId, driverId, start, end, excludeId, transaction }) => {
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime()))
    throw new HttpError(400, "A valid assignment start and end date/time is required.");
  if (end <= start) throw new HttpError(400, "Assignment end must be after the assignment start.");
  if (end <= new Date()) throw new HttpError(400, "Assignment end must be in the future.");

  const tour = await Tour.findByPk(tourId, { transaction });
  if (!tour) throw new HttpError(404, "Tour not found.");
  if (tour.status !== "planned")
    throw new HttpError(409, `Buses and drivers can only be assigned to a planned tour (this tour is ${tour.status}).`);

  const bus = await Bus.findByPk(busId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!bus) throw new HttpError(404, "Bus not found.");

  // Lock the drivers row only (MySQL/MariaDB cannot lock "OF" one table of a join), then load the login account
  const driver = await Driver.findByPk(driverId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!driver) throw new HttpError(404, "Driver not found.");

  driver.user = await User.findByPk(driver.userId, {
    attributes: ["id", "firstName", "lastName", "email", "status"],
    transaction,
  });

  const owner = await BusOwner.findByPk(bus.ownerId, { transaction });

  const busIssues = await busProblems(bus, owner, start, end, excludeId, transaction);
  if (busIssues.length) throw new HttpError(409, busIssues[0]);

  const driverIssues = await driverProblems(driver, start, end, excludeId, transaction);
  if (driverIssues.length) throw new HttpError(409, driverIssues[0]);

  const warnings = [];
  if (bus.seatingCapacity < tour.passengerCount)
    warnings.push(
      `This bus has ${bus.seatingCapacity} seats but the tour has ${tour.passengerCount} passengers. Assign more buses to cover everyone.`
    );

  return { tour, bus, driver, owner, warnings };
};

// ---- Bus status bookkeeping -----------------------------------------------------------------

const holdBus = (busId, transaction) =>
  Bus.update({ status: "assigned" }, { where: { id: busId, status: "available" }, transaction });

const releaseBusIfFree = async (busId, transaction) => {
  const stillUsed = await TourAssignment.count({
    where: { busId, assignmentStatus: { [Op.in]: ACTIVE_STATUSES } },
    transaction,
  });
  if (!stillUsed)
    await Bus.update({ status: "available" }, { where: { id: busId, status: "assigned" }, transaction });
};

// ---- Secure action tokens -------------------------------------------------------------------

const revokeTokens = (assignmentId, transaction) =>
  AssignmentActionToken.update(
    { revokedAt: new Date() },
    { where: { assignmentId, usedAt: null, revokedAt: null }, transaction }
  );

// New single-use tokens for the owner and the driver. Only the SHA-256 hash is stored;
// the raw token exists only in the e-mail that is sent.
const issueTokens = async (assignment, owner, driver, transaction) => {
  await revokeTokens(assignment.id, transaction);

  const expiresAt = new Date(Date.now() + environment.assignmentTokenExpiresHours * 3600 * 1000);
  const targets = [
    { type: "owner", responderId: owner.id, email: owner.email },
    { type: "driver", responderId: driver.id, email: driver.user.email },
  ];

  const tokens = {};

  for (const target of targets) {
    const raw = crypto.randomBytes(32).toString("base64url");

    await AssignmentActionToken.create(
      {
        assignmentId: assignment.id,
        responderType: target.type,
        responderId: target.responderId,
        recipientEmail: target.email,
        tokenHash: hashToken(raw),
        expiresAt,
      },
      { transaction }
    );

    tokens[target.type] = { raw, expiresAt };
  }

  return tokens;
};

// Look a raw token up (read only). Returns the row or throws a descriptive HttpError.
const findUsableToken = async (rawToken, transaction) => {
  if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > 200)
    throw new HttpError(400, "This link is not valid.");

  const row = await AssignmentActionToken.findOne({
    where: { tokenHash: hashToken(rawToken) },
    transaction,
  });

  if (!row) throw new HttpError(400, "This link is not valid.");
  if (row.usedAt) throw new HttpError(410, "This link has already been used.");
  if (row.revokedAt) throw new HttpError(410, "This link is no longer valid because the assignment changed.");
  if (row.expiresAt <= new Date()) throw new HttpError(410, "This link has expired.");

  return row;
};

// ---- Accept / reject ------------------------------------------------------------------------

// Record one party's answer. Must run inside a transaction.
// Sets the assignment to confirmed (both accepted) or rejected (anyone rejected).
const processResponse = async ({ assignmentId, party, responderId, response, reason, tokenId, req, transaction }) => {
  const assignment = await TourAssignment.findByPk(assignmentId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!assignment) throw new HttpError(404, "Assignment not found.");

  // Only the person the assignment was addressed to may answer
  const expectedId = party === "driver" ? assignment.driverId : assignment.ownerId;
  if (Number(expectedId) !== Number(responderId))
    throw new HttpError(403, "You are not allowed to respond to this assignment.");

  if (assignment.assignmentStatus !== "pending")
    throw new HttpError(409, `This assignment is already ${assignment.assignmentStatus} and can no longer be answered.`);

  const statusField = party === "driver" ? "driverStatus" : "ownerStatus";
  if (assignment[statusField] !== "pending")
    throw new HttpError(409, `You have already ${assignment[statusField]} this assignment.`);

  // Burn the token atomically: only one request can ever win
  if (tokenId) {
    const [used] = await AssignmentActionToken.update(
      { usedAt: new Date() },
      {
        where: { id: tokenId, usedAt: null, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
        transaction,
      }
    );
    if (!used) throw new HttpError(410, "This link is no longer valid.");
  }

  await AssignmentResponse.create(
    {
      assignmentId: assignment.id,
      responderType: party,
      responderId,
      response,
      reason: reason || null,
      respondedAt: new Date(),
      ipAddress: req?.ip ? String(req.ip).slice(0, 45) : null,
      userAgent: req?.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 500) : null,
    },
    { transaction }
  );

  const updates = { [statusField]: response };

  if (response === "rejected") {
    updates.assignmentStatus = "rejected";
    updates.rejectionReason = reason || null;
  } else {
    const otherStatus = party === "driver" ? assignment.ownerStatus : assignment.driverStatus;
    if (otherStatus === "accepted") {
      updates.assignmentStatus = "confirmed";
      updates.confirmedAt = new Date();
    }
  }

  await assignment.update(updates, { transaction });

  if (response === "rejected") {
    await revokeTokens(assignment.id, transaction);
    await releaseBusIfFree(assignment.busId, transaction);
  }

  return assignment;
};

module.exports = {
  ACTIVE_STATUSES,
  DETAIL_INCLUDES,
  loadDetail,
  findConflicts,
  busProblems,
  driverProblems,
  prepareAssignment,
  holdBus,
  releaseBusIfFree,
  revokeTokens,
  issueTokens,
  findUsableToken,
  processResponse,
};
