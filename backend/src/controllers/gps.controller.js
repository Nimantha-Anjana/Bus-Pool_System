const { Op } = require("sequelize");
const { GpsLocation, TourAssignment, Tour, Driver, User, Bus } = require("../models");
const { parseDateTime } = require("../utils/date.utils");
const { parseId, sendError } = require("../utils/validators");

const MAX_POINTS_PER_REQUEST = 100;
const MAX_HISTORY_LIMIT = 5000;
const LIVE_WINDOW_MS = 5 * 60 * 1000; // newer than 5 minutes = "live"
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const optionalNumber = (value, { min, max, label }) => {
  if (value === undefined || value === null || value === "") return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max)
    return { error: `${label} must be a number between ${min} and ${max}.` };
  return { value: number };
};

// Validate one GPS point and convert it to a row (without assignmentId)
const parsePoint = (raw, index, now) => {
  const label = `Point ${index + 1}`;
  if (!raw || typeof raw !== "object") return { error: `${label} must be an object.` };

  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (raw.latitude === undefined || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    return { error: `${label}: latitude must be a number between -90 and 90.` };
  if (raw.longitude === undefined || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    return { error: `${label}: longitude must be a number between -180 and 180.` };

  const accuracy = optionalNumber(raw.accuracy, { min: 0, max: 100000, label: `${label}: accuracy` });
  const speed = optionalNumber(raw.speed, { min: 0, max: 200, label: `${label}: speed (m/s)` });
  const heading = optionalNumber(raw.heading, { min: 0, max: 360, label: `${label}: heading` });
  for (const part of [accuracy, speed, heading]) if (part.error) return { error: part.error };

  let recordedAt = now;
  if (raw.recordedAt !== undefined && raw.recordedAt !== null && raw.recordedAt !== "") {
    recordedAt = parseDateTime(raw.recordedAt);
    if (!recordedAt) return { error: `${label}: recordedAt is not a valid date/time.` };
    if (recordedAt.getTime() - now.getTime() > MAX_FUTURE_MS)
      return { error: `${label}: recordedAt is in the future.` };
    if (now.getTime() - recordedAt.getTime() > MAX_AGE_MS)
      return { error: `${label}: recordedAt is older than 24 hours.` };
  }

  return {
    row: {
      latitude,
      longitude,
      accuracy: accuracy.value,
      speed: speed.value,
      heading: heading.value,
      recordedAt,
      receivedAt: now,
    },
  };
};

const toPoint = (row) => ({
  id: row.id,
  assignmentId: row.assignmentId,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  accuracy: row.accuracy === null ? null : Number(row.accuracy),
  speed: row.speed === null ? null : Number(row.speed),
  heading: row.heading === null ? null : Number(row.heading),
  recordedAt: row.recordedAt,
  receivedAt: row.receivedAt,
});

// POST /api/driver/gps
//   one point:  { assignmentId?, latitude, longitude, accuracy?, speed?, heading?, recordedAt? }
//   many points (e.g. sent after being offline): { assignmentId?, points: [ ...up to 100 ] }
// Accepted only for the driver's own CONFIRMED assignment whose tour is ONGOING.
const saveLocation = async (req, res, next) => {
  try {
    const body = req.body || {};
    const rawPoints = Array.isArray(body.points) ? body.points : [body];

    if (rawPoints.length < 1 || rawPoints.length > MAX_POINTS_PER_REQUEST)
      return sendError(res, 400, `Send between 1 and ${MAX_POINTS_PER_REQUEST} points per request.`);

    const now = new Date();
    const rows = [];

    for (let i = 0; i < rawPoints.length; i++) {
      const result = parsePoint(rawPoints[i], i, now);
      if (result.error) return sendError(res, 400, result.error);
      rows.push(result.row);
    }

    // Find which assignment this belongs to
    const requestedId = body.assignmentId !== undefined ? parseId(body.assignmentId) : null;
    if (body.assignmentId !== undefined && !requestedId) return sendError(res, 400, "Invalid assignmentId.");

    const eligible = await TourAssignment.findAll({
      where: {
        driverId: req.user.driverId,
        assignmentStatus: "confirmed",
        ...(requestedId ? { id: requestedId } : {}),
      },
      include: [{ model: Tour, as: "tour", where: { status: "ongoing" }, attributes: ["id", "tourCode"] }],
    });

    if (!eligible.length) {
      if (requestedId) {
        const own = await TourAssignment.findOne({
          where: { id: requestedId, driverId: req.user.driverId },
          attributes: ["id"],
        });
        if (!own) return sendError(res, 404, "Assignment not found.");
      }
      return sendError(res, 409, "GPS is only accepted for a confirmed assignment whose tour is ongoing.");
    }

    if (eligible.length > 1)
      return sendError(res, 400, "You have more than one active assignment. Send assignmentId.");

    const assignment = eligible[0];

    await GpsLocation.bulkCreate(rows.map((row) => ({ ...row, assignmentId: assignment.id })));

    return res.status(201).json({
      success: true,
      message: `${rows.length} location point(s) saved.`,
      data: { assignmentId: assignment.id, saved: rows.length },
    });
  } catch (error) {
    next(error);
  }
};

const findBus = async (req, res) => {
  const busId = parseId(req.params.id);
  if (!busId) {
    sendError(res, 400, "Invalid bus ID.");
    return null;
  }

  const bus = await Bus.findByPk(busId, { attributes: ["id", "registrationNumber", "busName"] });
  if (!bus) {
    sendError(res, 404, "Bus not found.");
    return null;
  }

  return bus;
};

// GET /api/admin/buses/:id/location   -> latest known position
const getBusLocation = async (req, res, next) => {
  try {
    const bus = await findBus(req, res);
    if (!bus) return;

    const latest = await GpsLocation.findOne({
      include: [
        {
          model: TourAssignment,
          as: "assignment",
          where: { busId: bus.id },
          required: true,
          attributes: ["id", "tourId", "assignmentStatus"],
          include: [
            { model: Tour, as: "tour", attributes: ["id", "tourCode", "tourName", "status"] },
            {
              model: Driver,
              as: "driver",
              attributes: ["id"],
              include: [{ model: User, as: "user", attributes: ["firstName", "lastName", "phone"] }],
            },
          ],
        },
      ],
      order: [["recordedAt", "DESC"], ["id", "DESC"]],
    });

    if (!latest) {
      return res.status(200).json({
        success: true,
        message: "No GPS data has been received for this bus yet.",
        data: { bus, location: null, isLive: false },
      });
    }

    const assignment = latest.assignment;

    return res.status(200).json({
      success: true,
      message: "Latest bus location retrieved successfully.",
      data: {
        bus,
        location: toPoint(latest),
        isLive: Date.now() - new Date(latest.receivedAt).getTime() <= LIVE_WINDOW_MS,
        tour: assignment.tour,
        driver: {
          id: assignment.driver.id,
          name: `${assignment.driver.user.firstName} ${assignment.driver.user.lastName}`,
          phone: assignment.driver.user.phone,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/buses/:id/gps-history?from=&to=&assignmentId=&order=asc|desc&limit=
const getBusGpsHistory = async (req, res, next) => {
  try {
    const bus = await findBus(req, res);
    if (!bus) return;

    const where = {};
    const from = parseDateTime(req.query.from);
    const to = parseDateTime(req.query.to);
    if (req.query.from && !from) return sendError(res, 400, "from is not a valid date/time.");
    if (req.query.to && !to) return sendError(res, 400, "to is not a valid date/time.");
    if (from) where.recordedAt = { ...(where.recordedAt || {}), [Op.gte]: from };
    if (to) where.recordedAt = { ...(where.recordedAt || {}), [Op.lte]: to };

    const assignmentWhere = { busId: bus.id };
    if (req.query.assignmentId !== undefined) {
      const assignmentId = parseId(req.query.assignmentId);
      if (!assignmentId) return sendError(res, 400, "Invalid assignmentId.");
      assignmentWhere.id = assignmentId;
    }

    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, MAX_HISTORY_LIMIT) : 500;
    const direction = String(req.query.order).toLowerCase() === "desc" ? "DESC" : "ASC";

    const rows = await GpsLocation.findAll({
      where,
      include: [{ model: TourAssignment, as: "assignment", where: assignmentWhere, required: true, attributes: [] }],
      order: [["recordedAt", direction], ["id", direction]],
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "GPS history retrieved successfully.",
      data: {
        bus,
        count: rows.length,
        limit,
        points: rows.map(toPoint),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { saveLocation, getBusLocation, getBusGpsHistory };
