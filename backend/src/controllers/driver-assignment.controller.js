const { TourAssignment, Tour, TourStop, Bus } = require("../models");
const { withTransaction } = require("../utils/transaction.util");
const { parseId, sendError } = require("../utils/validators");
const { processResponse } = require("../services/assignment.service");
const { announceResponse } = require("../services/assignment-events.service");

const STATUSES = ["pending", "confirmed", "rejected", "cancelled", "completed"];

// What a driver may see: the tour with its stops and the bus. Owner contact details stay private.
const DRIVER_INCLUDES = [
  { model: Tour, as: "tour", include: [{ model: TourStop, as: "stops" }] },
  { model: Bus, as: "bus", attributes: ["id", "registrationNumber", "busName", "busType", "seatingCapacity"] },
];

const STOP_ORDER = [[{ model: Tour, as: "tour" }, { model: TourStop, as: "stops" }, "stopOrder", "ASC"]];

const MIN_REASON = 3;
const MAX_REASON = 1000;

// GET /api/driver/assignments?status=
const getMyAssignments = async (req, res, next) => {
  try {
    const where = { driverId: req.user.driverId };
    if (STATUSES.includes(req.query.status)) where.assignmentStatus = req.query.status;

    const assignments = await TourAssignment.findAll({
      where,
      include: DRIVER_INCLUDES,
      order: [["assignedStartAt", "DESC"], ...STOP_ORDER],
    });

    return res.status(200).json({
      success: true,
      message: "Assignments retrieved successfully.",
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/driver/assignments/:id
const getMyAssignment = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid assignment ID.");

    const assignment = await TourAssignment.findOne({
      where: { id, driverId: req.user.driverId },
      include: DRIVER_INCLUDES,
      order: STOP_ORDER,
    });
    if (!assignment) return sendError(res, 404, "Assignment not found.");

    return res.status(200).json({
      success: true,
      message: "Assignment retrieved successfully.",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/driver/assignments/:id/accept   |   /reject  (reject needs a reason)
const respond = (response) => async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid assignment ID.");

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (response === "rejected" && (reason.length < MIN_REASON || reason.length > MAX_REASON))
      return sendError(res, 400, `Please give a reason for rejecting (${MIN_REASON}-${MAX_REASON} characters).`);
    if (reason.length > MAX_REASON) return sendError(res, 400, `The note must be ${MAX_REASON} characters or fewer.`);

    // A driver only ever sees their own assignments (404 instead of 403 hides other IDs)
    const own = await TourAssignment.findOne({
      where: { id, driverId: req.user.driverId },
      attributes: ["id"],
    });
    if (!own) return sendError(res, 404, "Assignment not found.");

    const assignment = await withTransaction((transaction) =>
      processResponse({
        assignmentId: id,
        party: "driver",
        responderId: req.user.driverId,
        response,
        reason: reason || null,
        req,
        transaction,
      })
    );

    await announceResponse({
      assignmentId: id,
      party: "driver",
      response,
      reason,
      req,
      actorUserId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message:
        response === "accepted"
          ? assignment.assignmentStatus === "confirmed"
            ? "Assignment accepted. It is now confirmed."
            : "Assignment accepted. Waiting for the bus owner."
          : "Assignment rejected.",
      data: {
        id: assignment.id,
        assignmentStatus: assignment.assignmentStatus,
        driverStatus: assignment.driverStatus,
        ownerStatus: assignment.ownerStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyAssignments,
  getMyAssignment,
  acceptAssignment: respond("accepted"),
  rejectAssignment: respond("rejected"),
};
