const { Op } = require("sequelize");
const {
  TourAssignment,
  Tour,
  Bus,
  BusOwner,
  Driver,
  User,
  AssignmentActionToken,
  AssignmentResponse,
  EmailLog,
  GpsLocation,
} = require("../models");
const { withTransaction, HttpError } = require("../utils/transaction.util");
const { parseDateTime, toDateOnly } = require("../utils/date.utils");
const { parseId, sendError } = require("../utils/validators");
const { createNotification } = require("../services/notification.service");
const { sendAssignmentEmails, getParties } = require("../services/email.service");
const {
  ACTIVE_STATUSES,
  DETAIL_INCLUDES,
  loadDetail,
  prepareAssignment,
  holdBus,
  releaseBusIfFree,
  revokeTokens,
  issueTokens,
} = require("../services/assignment.service");

const ASSIGNMENT_STATUSES = ["pending", "confirmed", "rejected", "cancelled", "completed"];

const windowOf = (tour) => ({
  start: tour.pickupAt || tour.startAt,
  end: tour.returnAt || tour.endAt,
});

const notifyDriver = (detail, type, title, message) =>
  createNotification({
    userId: detail.driver.user.id,
    title,
    message,
    type,
    relatedType: "assignment",
    relatedId: detail.id,
  });

// Send e-mails and merge the per-recipient outcomes into one response block
const sendBatch = async (batches) => {
  const results = [];
  let devActionLinks;

  for (const batch of batches) {
    if (!batch.recipients.length) continue;
    const outcome = await sendAssignmentEmails(batch);
    results.push(...outcome.results);
    if (outcome.devActionLinks) devActionLinks = { ...(devActionLinks || {}), ...outcome.devActionLinks };
  }

  return { emails: results, ...(devActionLinks ? { devActionLinks } : {}) };
};

// GET /api/admin/assignments?status=&tourId=&busId=&driverId=&ownerId=&from=&to=
const getAllAssignments = async (req, res, next) => {
  try {
    const { status, tourId, busId, driverId, ownerId, from, to } = req.query;
    const where = {};

    if (ASSIGNMENT_STATUSES.includes(status)) where.assignmentStatus = status;
    if (parseId(tourId)) where.tourId = parseId(tourId);
    if (parseId(busId)) where.busId = parseId(busId);
    if (parseId(driverId)) where.driverId = parseId(driverId);
    if (parseId(ownerId)) where.ownerId = parseId(ownerId);

    const fromDate = parseDateTime(from);
    const toDate = parseDateTime(to);
    if (fromDate) where.assignedEndAt = { [Op.gte]: fromDate };
    if (toDate) where.assignedStartAt = { [Op.lte]: toDate };

    const assignments = await TourAssignment.findAll({
      where,
      include: DETAIL_INCLUDES,
      order: [["assignedStartAt", "DESC"]],
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

// GET /api/admin/assignments/:id  (with responses, e-mail log and token status; never the token itself)
const getAssignmentById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid assignment ID.");

    const assignment = await TourAssignment.findByPk(id, {
      include: [
        ...DETAIL_INCLUDES,
        { model: AssignmentResponse, as: "responses" },
        {
          model: AssignmentActionToken,
          as: "actionTokens",
          attributes: ["id", "responderType", "recipientEmail", "expiresAt", "usedAt", "revokedAt", "createdAt"],
        },
        {
          model: EmailLog,
          as: "emailLogs",
          attributes: ["id", "recipientEmail", "emailType", "subject", "deliveryStatus", "attempts", "errorMessage", "sentAt", "createdAt"],
        },
      ],
      order: [
        [{ model: AssignmentResponse, as: "responses" }, "respondedAt", "ASC"],
        [{ model: EmailLog, as: "emailLogs" }, "createdAt", "DESC"],
      ],
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

// GET /api/admin/assignments/availability?tourId=  or  ?from=&to=   (+ optional excludeAssignmentId)
// Lists the buses and drivers that are free for that period.
const checkAvailability = async (req, res, next) => {
  try {
    const tourId = parseId(req.query.tourId);
    let start = parseDateTime(req.query.from);
    let end = parseDateTime(req.query.to);
    let tour = null;

    if (tourId) {
      tour = await Tour.findByPk(tourId);
      if (!tour) return sendError(res, 404, "Tour not found.");
      start = start || windowOf(tour).start;
      end = end || windowOf(tour).end;
    }

    if (!start || !end) return sendError(res, 400, "Provide tourId, or both from and to (ISO date/time).");
    if (end <= start) return sendError(res, 400, "The end must be after the start.");

    const excludeId = parseId(req.query.excludeAssignmentId);

    const busyRows = await TourAssignment.findAll({
      attributes: ["busId", "driverId"],
      where: {
        assignmentStatus: { [Op.in]: ACTIVE_STATUSES },
        assignedStartAt: { [Op.lt]: end },
        assignedEndAt: { [Op.gt]: start },
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      raw: true,
    });

    const busyBuses = new Set(busyRows.map((row) => Number(row.busId)));
    const busyDrivers = new Set(busyRows.map((row) => Number(row.driverId)));

    const [buses, drivers] = await Promise.all([
      Bus.findAll({
        where: { status: { [Op.notIn]: ["maintenance", "inactive"] } },
        attributes: ["id", "registrationNumber", "busName", "busType", "seatingCapacity", "airConditioned"],
        include: [{ model: BusOwner, as: "owner", where: { status: "active" }, attributes: ["id", "ownerName"] }],
        order: [["registrationNumber", "ASC"]],
      }),
      Driver.findAll({
        where: { status: "active", licenseExpiryDate: { [Op.gte]: toDateOnly(end) } },
        attributes: ["id", "licenseNumber", "licenseExpiryDate"],
        include: [
          { model: User, as: "user", where: { status: "active" }, attributes: ["id", "firstName", "lastName", "phone"] },
        ],
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Availability checked successfully.",
      data: {
        period: { start, end },
        ...(tour ? { tour: { id: tour.id, tourCode: tour.tourCode, passengerCount: tour.passengerCount } } : {}),
        availableBuses: buses.filter((bus) => !busyBuses.has(Number(bus.id))),
        availableDrivers: drivers.filter((driver) => !busyDrivers.has(Number(driver.id))),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/assignments   body: { tourId, busId, driverId, assignedStartAt?, assignedEndAt? }
const createAssignment = async (req, res, next) => {
  try {
    const body = req.body || {};
    const tourId = parseId(body.tourId);
    const busId = parseId(body.busId);
    const driverId = parseId(body.driverId);

    if (!tourId || !busId || !driverId) return sendError(res, 400, "tourId, busId and driverId are required.");

    const tourForWindow = await Tour.findByPk(tourId);
    if (!tourForWindow) return sendError(res, 404, "Tour not found.");

    const defaults = windowOf(tourForWindow);
    const start = body.assignedStartAt !== undefined ? parseDateTime(body.assignedStartAt) : defaults.start;
    const end = body.assignedEndAt !== undefined ? parseDateTime(body.assignedEndAt) : defaults.end;

    const { assignmentId, tokens, warnings } = await withTransaction(async (transaction) => {
      const context = await prepareAssignment({ tourId, busId, driverId, start, end, transaction });

      const assignment = await TourAssignment.create(
        {
          tourId,
          busId,
          driverId,
          ownerId: context.owner.id,
          assignedStartAt: start,
          assignedEndAt: end,
          ownerStatus: "pending",
          driverStatus: "pending",
          assignmentStatus: "pending",
          assignedBy: req.user.id,
        },
        { transaction }
      );

      await holdBus(busId, transaction);
      const issued = await issueTokens(assignment, context.owner, context.driver, transaction);

      return { assignmentId: assignment.id, tokens: issued, warnings: context.warnings };
    });

    const detail = await loadDetail(assignmentId);
    const parties = getParties(detail);

    await notifyDriver(
      detail,
      "assignment_created",
      "New tour assignment",
      `You were assigned to tour ${detail.tour.tourCode} (${detail.tour.startLocation} → ${detail.tour.destination}). Please accept or reject it.`
    );

    const emailOutcome = await sendBatch([
      { kind: "assignment_request", detail, recipients: [parties.owner, parties.driver], tokens },
    ]);

    return res.status(201).json({
      success: true,
      message: "Assignment created successfully. Waiting for the owner and the driver to respond.",
      data: detail,
      ...(warnings.length ? { warnings } : {}),
      ...emailOutcome,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/assignments/:id
//   cancel:  { "assignmentStatus": "cancelled" }
//   change:  { busId?, driverId?, assignedStartAt?, assignedEndAt? }  -> both parties must answer again
const updateAssignment = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid assignment ID.");

    const body = req.body || {};

    const outcome = await withTransaction(async (transaction) => {
      const assignment = await TourAssignment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!assignment) throw new HttpError(404, "Assignment not found.");

      if (["cancelled", "completed"].includes(assignment.assignmentStatus))
        throw new HttpError(409, `A ${assignment.assignmentStatus} assignment cannot be changed.`);

      const before = (await loadDetail(id, { transaction })).toJSON();

      // ---- cancel ----
      if (body.assignmentStatus !== undefined) {
        if (body.assignmentStatus !== "cancelled")
          throw new HttpError(400, 'The only status you can set here is "cancelled". Accept/reject is done by the owner and the driver.');
        if (assignment.assignmentStatus === "rejected")
          throw new HttpError(409, "This assignment was already rejected.");

        await assignment.update({ assignmentStatus: "cancelled", cancelledAt: new Date() }, { transaction });
        await revokeTokens(assignment.id, transaction);
        await releaseBusIfFree(assignment.busId, transaction);

        return { kind: "cancelled", before };
      }

      // ---- change bus / driver / period ----
      if (body.tourId !== undefined && Number(body.tourId) !== Number(assignment.tourId))
        throw new HttpError(400, "The tour of an assignment cannot be changed. Cancel it and create a new assignment.");

      const editable = ["busId", "driverId", "assignedStartAt", "assignedEndAt"];
      if (!editable.some((key) => body[key] !== undefined))
        throw new HttpError(400, "Provide busId, driverId, assignedStartAt or assignedEndAt (or assignmentStatus: cancelled).");

      const busId = body.busId !== undefined ? parseId(body.busId) : assignment.busId;
      const driverId = body.driverId !== undefined ? parseId(body.driverId) : assignment.driverId;
      if (!busId || !driverId) throw new HttpError(400, "busId and driverId must be valid IDs.");

      const start = body.assignedStartAt !== undefined ? parseDateTime(body.assignedStartAt) : assignment.assignedStartAt;
      const end = body.assignedEndAt !== undefined ? parseDateTime(body.assignedEndAt) : assignment.assignedEndAt;

      const unchanged =
        Number(busId) === Number(assignment.busId) &&
        Number(driverId) === Number(assignment.driverId) &&
        start?.getTime() === assignment.assignedStartAt.getTime() &&
        end?.getTime() === assignment.assignedEndAt.getTime();

      if (unchanged) return { kind: "unchanged" };

      const context = await prepareAssignment({
        tourId: assignment.tourId,
        busId,
        driverId,
        start,
        end,
        excludeId: assignment.id,
        transaction,
      });

      const oldBusId = assignment.busId;

      await assignment.update(
        {
          busId,
          driverId,
          ownerId: context.owner.id,
          assignedStartAt: start,
          assignedEndAt: end,
          ownerStatus: "pending",
          driverStatus: "pending",
          assignmentStatus: "pending",
          confirmedAt: null,
          rejectionReason: null,
        },
        { transaction }
      );

      await holdBus(busId, transaction);
      if (Number(oldBusId) !== Number(busId)) await releaseBusIfFree(oldBusId, transaction);

      const tokens = await issueTokens(assignment, context.owner, context.driver, transaction);

      return { kind: "updated", before, tokens, warnings: context.warnings };
    });

    if (outcome.kind === "unchanged") {
      return res.status(200).json({
        success: true,
        message: "Nothing to update: the assignment already has these values.",
        data: await loadDetail(id),
      });
    }

    const detail = await loadDetail(id);
    const now = getParties(detail);
    const old = getParties(outcome.before);

    if (outcome.kind === "cancelled") {
      await notifyDriver(
        detail,
        "assignment_cancelled",
        "Assignment cancelled",
        `Your assignment for tour ${detail.tour.tourCode} was cancelled by the admin.`
      );

      const emailOutcome = await sendBatch([
        { kind: "assignment_cancelled", detail, recipients: [now.owner, now.driver] },
      ]);

      return res.status(200).json({
        success: true,
        message: "Assignment cancelled successfully.",
        data: detail,
        ...emailOutcome,
      });
    }

    // updated: parties who stay get an "updated" mail, newcomers a normal request, replaced parties a cancellation
    const ownerChanged = Number(outcome.before.owner.id) !== Number(detail.owner.id);
    const driverChanged = Number(outcome.before.driver.id) !== Number(detail.driver.id);

    await notifyDriver(
      detail,
      driverChanged ? "assignment_created" : "assignment_updated",
      driverChanged ? "New tour assignment" : "Assignment updated",
      `Your assignment for tour ${detail.tour.tourCode} was ${driverChanged ? "created" : "changed"}. Please review it and respond again.`
    );

    if (driverChanged) {
      await createNotification({
        userId: outcome.before.driver.user.id,
        title: "Assignment removed",
        message: `You are no longer assigned to tour ${detail.tour.tourCode}.`,
        type: "assignment_cancelled",
        relatedType: "assignment",
        relatedId: detail.id,
      });
    }

    const replaced = [];
    if (ownerChanged) replaced.push(old.owner);
    if (driverChanged) replaced.push(old.driver);

    const emailOutcome = await sendBatch([
      {
        kind: "assignment_updated",
        detail,
        recipients: [...(ownerChanged ? [] : [now.owner]), ...(driverChanged ? [] : [now.driver])],
        tokens: outcome.tokens,
      },
      {
        kind: "assignment_request",
        detail,
        recipients: [...(ownerChanged ? [now.owner] : []), ...(driverChanged ? [now.driver] : [])],
        tokens: outcome.tokens,
      },
      { kind: "assignment_cancelled", detail: outcome.before, recipients: replaced },
    ]);

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully. The owner and the driver must respond again.",
      data: detail,
      ...(outcome.warnings.length ? { warnings: outcome.warnings } : {}),
      ...emailOutcome,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/assignments/:id/resend   (new links for whoever has not answered yet)
const resendAssignmentEmails = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid assignment ID.");

    const tokens = await withTransaction(async (transaction) => {
      const assignment = await TourAssignment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!assignment) throw new HttpError(404, "Assignment not found.");
      if (assignment.assignmentStatus !== "pending")
        throw new HttpError(409, `Only pending assignments can be re-sent (this one is ${assignment.assignmentStatus}).`);

      const detail = await loadDetail(id, { transaction });
      return issueTokens(assignment, detail.owner, detail.driver, transaction);
    });

    const detail = await loadDetail(id);
    const parties = getParties(detail);
    const recipients = [];
    if (detail.ownerStatus === "pending") recipients.push(parties.owner);
    if (detail.driverStatus === "pending") recipients.push(parties.driver);

    const emailOutcome = await sendBatch([{ kind: "assignment_request", detail, recipients, tokens }]);

    return res.status(200).json({
      success: true,
      message: "New response links sent. Older links no longer work.",
      ...emailOutcome,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/assignments/:id
const deleteAssignment = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid assignment ID.");

    const before = await withTransaction(async (transaction) => {
      const assignment = await TourAssignment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!assignment) throw new HttpError(404, "Assignment not found.");

      if (assignment.assignmentStatus === "confirmed")
        throw new HttpError(409, "A confirmed assignment cannot be deleted. Cancel it first.");
      if (assignment.assignmentStatus === "completed")
        throw new HttpError(409, "A completed assignment is kept as history and cannot be deleted.");

      if (await GpsLocation.count({ where: { assignmentId: id }, transaction }))
        throw new HttpError(409, "This assignment has GPS tracking history and cannot be deleted. Cancel it instead.");

      const snapshot = (await loadDetail(id, { transaction })).toJSON();

      await AssignmentActionToken.destroy({ where: { assignmentId: id }, transaction });
      await AssignmentResponse.destroy({ where: { assignmentId: id }, transaction });
      await EmailLog.destroy({ where: { assignmentId: id }, transaction });
      await assignment.destroy({ transaction });
      await releaseBusIfFree(assignment.busId, transaction);

      return { snapshot, wasPending: assignment.assignmentStatus === "pending" };
    });

    // People who were asked to respond should know it is gone (log row is not linked: the assignment no longer exists)
    if (before.wasPending) {
      const parties = getParties(before.snapshot);

      await createNotification({
        userId: before.snapshot.driver.user.id,
        title: "Assignment removed",
        message: `The assignment for tour ${before.snapshot.tour.tourCode} was removed.`,
        type: "assignment_cancelled",
      });

      await sendAssignmentEmails({
        kind: "assignment_cancelled",
        detail: before.snapshot,
        recipients: [parties.owner, parties.driver],
        logAssignmentId: null,
      });
    }

    return res.status(200).json({ success: true, message: "Assignment deleted successfully." });
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError")
      return sendError(res, 409, "Cannot delete this assignment because related records exist. Cancel it instead.");
    next(error);
  }
};

module.exports = {
  getAllAssignments,
  getAssignmentById,
  checkAvailability,
  createAssignment,
  updateAssignment,
  resendAssignmentEmails,
  deleteAssignment,
};
