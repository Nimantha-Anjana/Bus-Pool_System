const { sequelize } = require("../config/database");
const { Tour, TourStop } = require("../models");
const { parseDateTime } = require("../utils/date.utils");
const { isNonEmptyString, parseId, sendError } = require("../utils/validators");

const STOP_TYPES = ["pickup", "stop", "drop"];
const MAX_STOPS = 50;

// Validate + normalise one stop. `bounds` = { startAt, endAt, pickupAt, returnAt } (Date objects)
const normalizeStop = (item, bounds, label) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return { error: `${label} must be an object.` };

  if (!isNonEmptyString(item.stopName)) return { error: `${label}: stop name is required.` };
  if (item.stopName.trim().length > 200) return { error: `${label}: stop name must be 200 characters or fewer.` };

  const stopType = item.stopType ?? "stop";
  if (!STOP_TYPES.includes(stopType))
    return { error: `${label}: stop type must be one of: ${STOP_TYPES.join(", ")}.` };

  if (item.locationAddress && String(item.locationAddress).length > 255)
    return { error: `${label}: location address must be 255 characters or fewer.` };

  const hasLat = item.latitude !== undefined && item.latitude !== null && item.latitude !== "";
  const hasLng = item.longitude !== undefined && item.longitude !== null && item.longitude !== "";
  if (hasLat !== hasLng) return { error: `${label}: provide both latitude and longitude, or neither.` };

  let latitude = null;
  let longitude = null;
  if (hasLat) {
    latitude = Number(item.latitude);
    longitude = Number(item.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
      return { error: `${label}: latitude must be between -90 and 90.` };
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      return { error: `${label}: longitude must be between -180 and 180.` };
  }

  let plannedArrivalAt = null;
  if (item.plannedArrivalAt !== undefined && item.plannedArrivalAt !== null && item.plannedArrivalAt !== "") {
    plannedArrivalAt = parseDateTime(item.plannedArrivalAt);
    if (!plannedArrivalAt) return { error: `${label}: planned arrival time is not valid.` };

    const earliest = bounds.pickupAt || bounds.startAt;
    const latest = bounds.returnAt || bounds.endAt;
    if (plannedArrivalAt < earliest || plannedArrivalAt > latest)
      return { error: `${label}: planned arrival must fall within the tour time window.` };
  }

  return {
    value: {
      stopName: item.stopName.trim(),
      stopType,
      locationAddress: item.locationAddress?.trim() || null,
      latitude,
      longitude,
      plannedArrivalAt,
      notes: item.notes?.trim() || null,
    },
  };
};

// Validate a whole list (array order = stop order)
const validateStops = (stops, bounds) => {
  if (!Array.isArray(stops)) return { error: "Stops must be an array." };
  if (stops.length > MAX_STOPS) return { error: `A tour can have at most ${MAX_STOPS} stops.` };

  const list = [];
  for (let i = 0; i < stops.length; i++) {
    const result = normalizeStop(stops[i], bounds, `Stop ${i + 1}`);
    if (result.error) return { error: result.error };
    list.push(result.value);
  }
  return { list };
};

const mapStopRows = (tourId, list) =>
  list.map((stop, index) => ({ tourId, ...stop, stopOrder: index + 1 }));

// Renumber stops 1..n in the given id order (two passes so a unique (tour_id, stop_order) index never clashes)
const reorderStops = async (tourId, orderedIds, transaction) => {
  await TourStop.update(
    { stopOrder: sequelize.literal("stop_order + 1000") },
    { where: { tourId }, transaction }
  );

  for (let i = 0; i < orderedIds.length; i++) {
    await TourStop.update({ stopOrder: i + 1 }, { where: { id: orderedIds[i], tourId }, transaction });
  }
};

// Load the tour; stops of completed / cancelled tours are locked
const loadEditableTour = async (req, res, transaction) => {
  const tourId = parseId(req.params.id);
  if (!tourId) {
    sendError(res, 400, "Invalid tour ID.");
    return null;
  }

  const tour = await Tour.findByPk(tourId, { transaction });
  if (!tour) {
    sendError(res, 404, "Tour not found.");
    return null;
  }

  if (["completed", "cancelled"].includes(tour.status)) {
    sendError(res, 409, `Stops of a ${tour.status} tour cannot be changed.`);
    return null;
  }

  return tour;
};

const tourBounds = (tour) => ({
  startAt: tour.startAt,
  endAt: tour.endAt,
  pickupAt: tour.pickupAt,
  returnAt: tour.returnAt,
});

const listStops = (tourId, transaction) =>
  TourStop.findAll({ where: { tourId }, order: [["stopOrder", "ASC"]], transaction });

// GET /api/admin/tours/:id/stops
const getTourStops = async (req, res, next) => {
  try {
    const tourId = parseId(req.params.id);
    if (!tourId) return sendError(res, 400, "Invalid tour ID.");

    const tour = await Tour.findByPk(tourId, { attributes: ["id"] });
    if (!tour) return sendError(res, 404, "Tour not found.");

    return res.status(200).json({
      success: true,
      message: "Tour stops retrieved successfully.",
      data: await listStops(tourId),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/tours/:id/stops    body: { stops: [ { stopName, stopType, ... } ] }  (replaces all stops)
const replaceTourStops = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const tour = await loadEditableTour(req, res, transaction);
    if (!tour) return transaction.rollback();

    const result = validateStops((req.body || {}).stops, tourBounds(tour));
    if (result.error) {
      await transaction.rollback();
      return sendError(res, 400, result.error);
    }

    await TourStop.destroy({ where: { tourId: tour.id }, transaction });
    if (result.list.length) await TourStop.bulkCreate(mapStopRows(tour.id, result.list), { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Tour stops updated successfully.",
      data: await listStops(tour.id),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

// POST /api/admin/tours/:id/stops    body: stop fields + optional stopOrder (insert position)
const addTourStop = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const tour = await loadEditableTour(req, res, transaction);
    if (!tour) return transaction.rollback();

    const existing = await listStops(tour.id, transaction);
    if (existing.length >= MAX_STOPS) {
      await transaction.rollback();
      return sendError(res, 409, `A tour can have at most ${MAX_STOPS} stops.`);
    }

    const body = req.body || {};
    const result = normalizeStop(body, tourBounds(tour), "Stop");
    if (result.error) {
      await transaction.rollback();
      return sendError(res, 400, result.error);
    }

    const created = await TourStop.create(
      { tourId: tour.id, ...result.value, stopOrder: existing.length + 1 },
      { transaction }
    );

    // insert position: 1..n+1 (default = append)
    const requested = Number(body.stopOrder);
    const position = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, existing.length + 1) : existing.length + 1;

    const ids = existing.map((stop) => stop.id);
    ids.splice(position - 1, 0, created.id);
    await reorderStops(tour.id, ids, transaction);

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Tour stop added successfully.",
      data: await TourStop.findByPk(created.id),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

// PUT /api/admin/tours/:id/stops/:stopId    (partial update; stopOrder moves the stop)
const updateTourStop = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const tour = await loadEditableTour(req, res, transaction);
    if (!tour) return transaction.rollback();

    const stopId = parseId(req.params.stopId);
    const stop = stopId ? await TourStop.findOne({ where: { id: stopId, tourId: tour.id }, transaction }) : null;
    if (!stop) {
      await transaction.rollback();
      return sendError(res, 404, "Tour stop not found.");
    }

    const body = req.body || {};
    const merged = { ...stop.toJSON(), ...body };
    const result = normalizeStop(merged, tourBounds(tour), "Stop");
    if (result.error) {
      await transaction.rollback();
      return sendError(res, 400, result.error);
    }

    await stop.update(result.value, { transaction });

    if (body.stopOrder !== undefined) {
      const requested = Number(body.stopOrder);
      if (!Number.isInteger(requested) || requested < 1) {
        await transaction.rollback();
        return sendError(res, 400, "stopOrder must be a whole number of 1 or more.");
      }

      const ids = (await listStops(tour.id, transaction)).map((s) => s.id).filter((id) => id !== stop.id);
      ids.splice(Math.min(requested, ids.length + 1) - 1, 0, stop.id);
      await reorderStops(tour.id, ids, transaction);
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Tour stop updated successfully.",
      data: await TourStop.findByPk(stop.id),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

// DELETE /api/admin/tours/:id/stops/:stopId
const deleteTourStop = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const tour = await loadEditableTour(req, res, transaction);
    if (!tour) return transaction.rollback();

    const stopId = parseId(req.params.stopId);
    const stop = stopId ? await TourStop.findOne({ where: { id: stopId, tourId: tour.id }, transaction }) : null;
    if (!stop) {
      await transaction.rollback();
      return sendError(res, 404, "Tour stop not found.");
    }

    await stop.destroy({ transaction });

    const remaining = (await listStops(tour.id, transaction)).map((s) => s.id);
    await reorderStops(tour.id, remaining, transaction);

    await transaction.commit();

    return res.status(200).json({ success: true, message: "Tour stop deleted successfully." });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

module.exports = {
  validateStops,
  mapStopRows,
  getTourStops,
  replaceTourStops,
  addTourStop,
  updateTourStop,
  deleteTourStop,
};
