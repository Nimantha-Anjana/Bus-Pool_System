const crypto = require("crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Tour, TourStop, TourAssignment, Bus, User } = require("../models");
const { parseDateTime } = require("../utils/date.utils");
const { isNonEmptyString, parseId, sendError } = require("../utils/validators");
const { validateStops, mapStopRows } = require("./tour-stop.controller");

const TOUR_TYPES = ["local", "foreign"];
const ACTIVE_ASSIGNMENT_STATUSES = ["pending", "confirmed"];
const MAX_PASSENGERS = 1000;

// Stored status (DB enum)        -> label shown to the admin
//   planned + no confirmed bus   -> "pending"
//   planned + confirmed bus      -> "scheduled"
//   ongoing / completed / cancelled stay as they are
const TRANSITIONS = {
  planned: ["ongoing", "cancelled"],
  ongoing: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const TOUR_INCLUDES = [
  { model: TourStop, as: "stops" },
  { model: User, as: "creator", attributes: ["id", "firstName", "lastName"] },
  { model: TourAssignment, as: "assignments", attributes: ["id", "assignmentStatus", "busId", "driverId"] },
];

const STOP_ORDER = [[{ model: TourStop, as: "stops" }, "stopOrder", "ASC"]];

const serializeTour = (tour) => {
  const plain = tour.toJSON();
  const assignments = plain.assignments || [];
  const hasConfirmed = assignments.some((a) => a.assignmentStatus === "confirmed");

  let displayStatus = plain.status;
  if (plain.status === "planned") displayStatus = hasConfirmed ? "scheduled" : "pending";

  return {
    ...plain,
    displayStatus,
    assignmentCount: assignments.filter((a) => ACTIVE_ASSIGNMENT_STATUSES.includes(a.assignmentStatus)).length,
    hasConfirmedAssignment: hasConfirmed,
  };
};

const findTourWithDetails = (id, options = {}) =>
  Tour.findByPk(id, { include: TOUR_INCLUDES, order: STOP_ORDER, ...options });

const countActiveAssignments = (tourId, transaction) =>
  TourAssignment.count({
    where: { tourId, assignmentStatus: { [Op.in]: ACTIVE_ASSIGNMENT_STATUSES } },
    transaction,
  });

const generateTourCode = async (startAt) => {
  const day = startAt.toISOString().slice(0, 10).replace(/-/g, "");

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `TR-${day}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    if (!(await Tour.findOne({ where: { tourCode: code }, attributes: ["id"] }))) return code;
  }
  throw new Error("Could not generate a unique tour code.");
};

// Date/time rules. `values` holds the final (merged) values as Date objects.
const validateTourDates = ({ startAt, endAt, pickupAt, returnAt }, { checkFuture }) => {
  const errors = [];

  if (!startAt) errors.push("A valid start date/time is required (ISO format).");
  if (!endAt) errors.push("A valid end date/time is required (ISO format).");
  if (pickupAt === false) errors.push("Pickup date/time is not valid.");
  if (returnAt === false) errors.push("Return date/time is not valid.");
  if (errors.length) return errors;

  if (checkFuture && startAt.getTime() <= Date.now()) errors.push("Tour start must be in the future.");
  if (endAt.getTime() <= startAt.getTime()) errors.push("Tour end must be after the tour start.");
  if (pickupAt && pickupAt.getTime() > startAt.getTime())
    errors.push("Pickup time must be at or before the tour start.");
  if (returnAt && returnAt.getTime() < endAt.getTime())
    errors.push("Return time must be at or after the tour end.");

  return errors;
};

// Optional date field: undefined -> keep, null/"" -> clear, string -> parsed (false when invalid)
const readOptionalDate = (value) => {
  if (value === null || value === "") return null;
  return parseDateTime(value) || false;
};

const validateTourFields = (body, { partial }) => {
  const errors = [];
  const has = (key) => body[key] !== undefined;

  const requiredText = [
    ["tourName", "Tour name", 200],
    ["startLocation", "Start location", 255],
    ["destination", "Destination", 255],
  ];

  for (const [key, label, max] of requiredText) {
    if (!partial || has(key)) {
      if (!isNonEmptyString(body[key])) errors.push(`${label} is required.`);
      else if (body[key].trim().length > max) errors.push(`${label} must be ${max} characters or fewer.`);
    }
  }

  if (has("tourType") && !TOUR_TYPES.includes(body.tourType))
    errors.push(`Tour type must be one of: ${TOUR_TYPES.join(", ")}.`);

  if (!partial || has("passengerCount")) {
    const count = Number(body.passengerCount);
    if (!Number.isInteger(count) || count < 1 || count > MAX_PASSENGERS)
      errors.push(`Passenger count must be a whole number between 1 and ${MAX_PASSENGERS}.`);
  }

  if (has("tourCode") && body.tourCode !== null && body.tourCode !== "") {
    if (!/^[A-Za-z0-9-]{3,30}$/.test(String(body.tourCode).trim()))
      errors.push("Tour code must be 3-30 letters, digits or hyphens.");
  }

  return errors;
};

// GET /api/admin/tours?status=&tourType=&search=&from=&to=
// status accepts: pending, scheduled, ongoing, completed, cancelled (planned = pending + scheduled)
const getAllTours = async (req, res, next) => {
  try {
    const { status, tourType, search, from, to } = req.query;
    const where = {};

    if (["planned", "pending", "scheduled"].includes(status)) where.status = "planned";
    else if (["ongoing", "completed", "cancelled"].includes(status)) where.status = status;

    if (TOUR_TYPES.includes(tourType)) where.tourType = tourType;

    const fromDate = parseDateTime(from);
    const toDate = parseDateTime(to);
    if (fromDate) where.startAt = { ...(where.startAt || {}), [Op.gte]: fromDate };
    if (toDate) where.startAt = { ...(where.startAt || {}), [Op.lte]: toDate };

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = [
        { tourCode: { [Op.like]: term } },
        { tourName: { [Op.like]: term } },
        { startLocation: { [Op.like]: term } },
        { destination: { [Op.like]: term } },
      ];
    }

    const tours = await Tour.findAll({
      where,
      include: TOUR_INCLUDES,
      order: [["startAt", "DESC"], ...STOP_ORDER],
    });

    let data = tours.map(serializeTour);
    if (status === "pending" || status === "scheduled") data = data.filter((t) => t.displayStatus === status);

    return res.status(200).json({ success: true, message: "Tours retrieved successfully.", data });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/tours/:id
const getTourById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid tour ID.");

    const tour = await findTourWithDetails(id);
    if (!tour) return sendError(res, 404, "Tour not found.");

    return res.status(200).json({
      success: true,
      message: "Tour retrieved successfully.",
      data: serializeTour(tour),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/tours   (optional "stops": [...] is saved together with the tour)
const createTour = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  const fail = async (status, message, errors) => {
    await transaction.rollback();
    return sendError(res, status, message, errors);
  };

  try {
    const body = req.body || {};
    const errors = validateTourFields(body, { partial: false });

    const dates = {
      startAt: parseDateTime(body.startAt),
      endAt: parseDateTime(body.endAt),
      pickupAt: readOptionalDate(body.pickupAt),
      returnAt: readOptionalDate(body.returnAt),
    };
    errors.push(...validateTourDates(dates, { checkFuture: true }));

    let stopRows = [];
    if (body.stops !== undefined && !errors.length) {
      const result = validateStops(body.stops, dates);
      if (result.error) errors.push(result.error);
      else stopRows = result.list;
    }

    if (errors.length) return fail(400, errors[0], errors);

    let tourCode = body.tourCode ? String(body.tourCode).trim().toUpperCase() : null;
    if (tourCode) {
      if (await Tour.findOne({ where: { tourCode }, attributes: ["id"] }))
        return fail(409, "A tour with this tour code already exists.");
    } else {
      tourCode = await generateTourCode(dates.startAt);
    }

    const tour = await Tour.create(
      {
        tourCode,
        tourName: body.tourName.trim(),
        tourType: body.tourType || "local",
        description: body.description?.trim() || null,
        startLocation: body.startLocation.trim(),
        destination: body.destination.trim(),
        startAt: dates.startAt,
        endAt: dates.endAt,
        pickupAt: dates.pickupAt || null,
        returnAt: dates.returnAt || null,
        passengerCount: Number(body.passengerCount),
        specialNotes: body.specialNotes?.trim() || null,
        status: "planned",
        createdBy: req.user.id,
      },
      { transaction }
    );

    if (stopRows.length) await TourStop.bulkCreate(mapStopRows(tour.id, stopRows), { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Tour created successfully.",
      data: serializeTour(await findTourWithDetails(tour.id)),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error.name === "SequelizeUniqueConstraintError")
      return sendError(res, 409, "A tour with this tour code already exists.");
    next(error);
  }
};

// PUT /api/admin/tours/:id
const updateTour = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  const fail = async (status, message, errors) => {
    await transaction.rollback();
    return sendError(res, status, message, errors);
  };

  try {
    const id = parseId(req.params.id);
    if (!id) return fail(400, "Invalid tour ID.");

    const tour = await Tour.findByPk(id, { transaction });
    if (!tour) return fail(404, "Tour not found.");

    if (["completed", "cancelled"].includes(tour.status))
      return fail(409, `A ${tour.status} tour cannot be edited.`);

    const body = req.body || {};
    if (body.status !== undefined)
      return fail(400, "Use PATCH /api/admin/tours/:id/status to change the tour status.");

    const errors = validateTourFields(body, { partial: true });

    // Merge new values over the stored ones, then validate the dates as a whole
    const dateKeys = ["startAt", "endAt", "pickupAt", "returnAt"];
    const datesChanged = dateKeys.some((key) => body[key] !== undefined);

    const merged = {
      startAt: body.startAt !== undefined ? parseDateTime(body.startAt) : tour.startAt,
      endAt: body.endAt !== undefined ? parseDateTime(body.endAt) : tour.endAt,
      pickupAt: body.pickupAt !== undefined ? readOptionalDate(body.pickupAt) : tour.pickupAt,
      returnAt: body.returnAt !== undefined ? readOptionalDate(body.returnAt) : tour.returnAt,
    };

    if (datesChanged) {
      if (tour.status === "ongoing") errors.push("The dates of an ongoing tour cannot be changed.");
      errors.push(...validateTourDates(merged, { checkFuture: body.startAt !== undefined }));
    }

    if (errors.length) return fail(400, errors[0], errors);

    if (datesChanged && (await countActiveAssignments(tour.id, transaction)) > 0)
      return fail(
        409,
        "Cannot change the tour dates while buses or drivers are assigned. Cancel the assignments first."
      );

    const updates = {};
    if (body.tourName !== undefined) updates.tourName = body.tourName.trim();
    if (body.tourType !== undefined) updates.tourType = body.tourType;
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.startLocation !== undefined) updates.startLocation = body.startLocation.trim();
    if (body.destination !== undefined) updates.destination = body.destination.trim();
    if (body.passengerCount !== undefined) updates.passengerCount = Number(body.passengerCount);
    if (body.specialNotes !== undefined) updates.specialNotes = body.specialNotes?.trim() || null;

    if (datesChanged) {
      updates.startAt = merged.startAt;
      updates.endAt = merged.endAt;
      updates.pickupAt = merged.pickupAt || null;
      updates.returnAt = merged.returnAt || null;
    }

    if (body.tourCode !== undefined && body.tourCode) {
      const tourCode = String(body.tourCode).trim().toUpperCase();
      const clash = await Tour.findOne({
        where: { tourCode, id: { [Op.ne]: tour.id } },
        attributes: ["id"],
      });
      if (clash) return fail(409, "A tour with this tour code already exists.");
      updates.tourCode = tourCode;
    }

    // Optional full replacement of the stops
    let stopRows;
    if (body.stops !== undefined) {
      const result = validateStops(body.stops, merged);
      if (result.error) return fail(400, result.error);
      stopRows = result.list;
    }

    await tour.update(updates, { transaction });

    if (stopRows !== undefined) {
      await TourStop.destroy({ where: { tourId: tour.id }, transaction });
      if (stopRows.length) await TourStop.bulkCreate(mapStopRows(tour.id, stopRows), { transaction });
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Tour updated successfully.",
      data: serializeTour(await findTourWithDetails(tour.id)),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error.name === "SequelizeUniqueConstraintError")
      return sendError(res, 409, "A tour with this tour code already exists.");
    next(error);
  }
};

// PATCH /api/admin/tours/:id/status   body: { "status": "ongoing" | "completed" | "cancelled" }
// "pending" / "scheduled" are not set by hand: a planned tour is "scheduled" once a bus is confirmed.
const updateTourStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  const fail = async (status, message) => {
    await transaction.rollback();
    return sendError(res, status, message);
  };

  try {
    const id = parseId(req.params.id);
    if (!id) return fail(400, "Invalid tour ID.");

    const { status } = req.body || {};

    if (["pending", "scheduled", "planned"].includes(status))
      return fail(
        400,
        "Pending/Scheduled are automatic: a new tour is Pending and becomes Scheduled once a bus assignment is confirmed. Set ongoing, completed or cancelled."
      );
    if (!["ongoing", "completed", "cancelled"].includes(status))
      return fail(400, "Status must be one of: ongoing, completed, cancelled.");

    const tour = await Tour.findByPk(id, { transaction });
    if (!tour) return fail(404, "Tour not found.");

    if (!TRANSITIONS[tour.status].includes(status))
      return fail(409, `A ${tour.status} tour cannot be changed to ${status}.`);

    const affected = await TourAssignment.findAll({
      where: { tourId: tour.id, assignmentStatus: { [Op.in]: ACTIVE_ASSIGNMENT_STATUSES } },
      transaction,
    });

    let warning = null;

    if (status === "ongoing") {
      if (!affected.some((a) => a.assignmentStatus === "confirmed"))
        warning = "This tour was started without a confirmed bus assignment.";
    } else {
      // completed: confirmed assignments finish, pending ones lapse. cancelled: everything is cancelled.
      for (const assignment of affected) {
        const finalStatus =
          status === "completed" && assignment.assignmentStatus === "confirmed" ? "completed" : "cancelled";
        await assignment.update({ assignmentStatus: next }, { transaction });
      }

      // Release buses that are no longer needed by any other active assignment
      for (const busId of [...new Set(affected.map((a) => a.busId))]) {
        const stillUsed = await TourAssignment.count({
          where: { busId, assignmentStatus: { [Op.in]: ACTIVE_ASSIGNMENT_STATUSES } },
          transaction,
        });
        if (!stillUsed) await Bus.update({ status: "available" }, { where: { id: busId, status: "assigned" }, transaction });
      }
    }

    await tour.update({ status }, { transaction });
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Tour is now ${status}.`,
      data: serializeTour(await findTourWithDetails(tour.id)),
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

// DELETE /api/admin/tours/:id
const deleteTour = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid tour ID.");

    const tour = await Tour.findByPk(id);
    if (!tour) return sendError(res, 404, "Tour not found.");

    if (["ongoing", "completed"].includes(tour.status))
      return sendError(res, 409, `A ${tour.status} tour cannot be deleted.${tour.status === "ongoing" ? " Cancel it first." : ""}`);

    if (await TourAssignment.count({ where: { tourId: tour.id } }))
      return sendError(
        res,
        409,
        "Cannot delete this tour because bus/driver assignments exist for it. Cancel the tour instead."
      );

    const transaction = await sequelize.transaction();
    try {
      await TourStop.destroy({ where: { tourId: tour.id }, transaction });
      await tour.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      if (error.name === "SequelizeForeignKeyConstraintError")
        return sendError(res, 409, "Cannot delete this tour because related records exist. Cancel the tour instead.");
      throw error;
    }

    return res.status(200).json({ success: true, message: "Tour deleted successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTours,
  getTourById,
  createTour,
  updateTour,
  updateTourStatus,
  deleteTour,
};
