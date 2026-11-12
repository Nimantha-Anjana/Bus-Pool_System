const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Bus, BusOwner, BusImage, BusFacility, TourAssignment } = require("../models");
const { removeFile } = require("../middleware/upload.middleware");
const {
  isNonEmptyString,
  parseId,
  sendError,
} = require("../utils/validators");

// "assigned" is managed by the tour-assignment flow, never set manually.
const MANUAL_STATUSES = ["available", "maintenance", "inactive"];
const ALL_STATUSES = ["available", "assigned", "maintenance", "inactive"];
const ACTIVE_ASSIGNMENT_STATUSES = ["pending", "confirmed"];
const MAX_FACILITIES = 30;

const BUS_INCLUDES = [
  { model: BusOwner, as: "owner", attributes: ["id", "ownerName", "phone", "email", "status"] },
  { model: BusImage, as: "images", attributes: ["id", "imageUrl", "isPrimary", "originalName"] },
  { model: BusFacility, as: "busFacilities", attributes: ["id", "facilityName"] },
];

// Shape one bus for API output
const serializeBus = (bus) => {
  const plain = bus.toJSON();
  const facilities = (plain.busFacilities || []).map((f) => f.facilityName);
  delete plain.busFacilities;

  return {
    ...plain,
    facilities,
    isAvailable: plain.status === "available",
  };
};

const findBusWithDetails = (id, options = {}) =>
  Bus.findByPk(id, { include: BUS_INCLUDES, ...options });

const countActiveAssignments = (busId, transaction) =>
  TourAssignment.count({
    where: { busId, assignmentStatus: { [Op.in]: ACTIVE_ASSIGNMENT_STATUSES } },
    transaction,
  });

// Trim, de-duplicate (case-insensitive) and validate a facilities list
const normalizeFacilities = (input) => {
  if (!Array.isArray(input)) return { error: "Facilities must be an array of names." };

  const seen = new Set();
  const list = [];

  for (const item of input) {
    if (typeof item !== "string" || !item.trim()) {
      return { error: "Each facility must be a non-empty text value." };
    }
    const name = item.trim();
    if (name.length > 80) return { error: "Facility names must be 80 characters or fewer." };

    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push(name);
    }
  }

  if (list.length > MAX_FACILITIES) {
    return { error: `A bus can have at most ${MAX_FACILITIES} facilities.` };
  }

  return { list };
};

// Replace all facilities of a bus (inside a transaction)
const replaceFacilities = async (bus, names, transaction) => {
  await BusFacility.destroy({ where: { busId: bus.id }, transaction });

  if (names.length) {
    await BusFacility.bulkCreate(
      names.map((facilityName) => ({ busId: bus.id, facilityName })),
      { transaction }
    );
  }

  // Keep the legacy JSON column in sync for any code that still reads it
  await bus.update({ facilities: names }, { transaction });
};

const validateBusFields = (body, { partial }) => {
  const errors = [];
  const has = (key) => body[key] !== undefined;

  if (!partial || has("registrationNumber")) {
    if (!isNonEmptyString(body.registrationNumber)) errors.push("Registration number is required.");
    else if (body.registrationNumber.trim().length > 30)
      errors.push("Registration number must be 30 characters or fewer.");
  }

  if (!partial || has("busType")) {
    if (!isNonEmptyString(body.busType)) errors.push("Bus type is required.");
    else if (body.busType.trim().length > 50) errors.push("Bus type must be 50 characters or fewer.");
  }

  if (!partial || has("seatingCapacity")) {
    const seats = Number(body.seatingCapacity);
    if (!Number.isInteger(seats) || seats < 1 || seats > 100)
      errors.push("Seating capacity must be a whole number between 1 and 100.");
  }

  if (has("busName") && body.busName !== null && String(body.busName).length > 150)
    errors.push("Bus name must be 150 characters or fewer.");

  if (has("airConditioned") && typeof body.airConditioned !== "boolean")
    errors.push("airConditioned must be true or false.");

  return errors;
};

const registrationInUse = async (registrationNumber, excludeId) => {
  const where = { registrationNumber };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return Boolean(await Bus.findOne({ where, attributes: ["id"] }));
};

// GET /api/admin/buses?status=&ownerId=&search=&airConditioned=
const getAllBuses = async (req, res, next) => {
  try {
    const { status, ownerId, search, airConditioned } = req.query;
    const where = {};

    if (status) {
      if (status === "unavailable") where.status = { [Op.ne]: "available" };
      else if (ALL_STATUSES.includes(status)) where.status = status;
    }

    if (ownerId && parseId(ownerId)) where.ownerId = parseId(ownerId);
    if (airConditioned === "true" || airConditioned === "false")
      where.airConditioned = airConditioned === "true";

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = [
        { registrationNumber: { [Op.like]: term } },
        { busName: { [Op.like]: term } },
        { busType: { [Op.like]: term } },
      ];
    }

    const buses = await Bus.findAll({
      where,
      include: BUS_INCLUDES,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Buses retrieved successfully.",
      data: buses.map(serializeBus),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/buses/:id
const getBusById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus ID.");

    const bus = await findBusWithDetails(id);
    if (!bus) return sendError(res, 404, "Bus not found.");

    return res.status(200).json({
      success: true,
      message: "Bus retrieved successfully.",
      data: serializeBus(bus),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/buses
const createBus = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const body = req.body || {};

    const errors = validateBusFields(body, { partial: false });

    const ownerId = parseId(body.ownerId);
    if (!ownerId) errors.push("A valid ownerId is required.");

    if (body.status !== undefined && !MANUAL_STATUSES.includes(body.status))
      errors.push(`Status must be one of: ${MANUAL_STATUSES.join(", ")}.`);

    let facilityNames = [];
    if (body.facilities !== undefined) {
      const result = normalizeFacilities(body.facilities);
      if (result.error) errors.push(result.error);
      else facilityNames = result.list;
    }

    if (errors.length) {
      await transaction.rollback();
      return sendError(res, 400, errors[0], errors);
    }

    const owner = await BusOwner.findByPk(ownerId, { transaction });
    if (!owner) {
      await transaction.rollback();
      return sendError(res, 404, "Bus owner not found.");
    }
    if (owner.status !== "active") {
      await transaction.rollback();
      return sendError(res, 409, "Cannot add a bus to an inactive bus owner.");
    }

    const registrationNumber = body.registrationNumber.trim().toUpperCase();
    if (await registrationInUse(registrationNumber)) {
      await transaction.rollback();
      return sendError(res, 409, "A bus with this registration number already exists.");
    }

    const bus = await Bus.create(
      {
        ownerId,
        registrationNumber,
        busName: body.busName?.trim() || null,
        busType: body.busType.trim(),
        seatingCapacity: Number(body.seatingCapacity),
        airConditioned: body.airConditioned ?? false,
        description: body.description?.trim() || null,
        status: body.status || "available",
        facilities: facilityNames,
      },
      { transaction }
    );

    if (facilityNames.length) await replaceFacilities(bus, facilityNames, transaction);

    await transaction.commit();

    const created = await findBusWithDetails(bus.id);

    return res.status(201).json({
      success: true,
      message: "Bus created successfully.",
      data: serializeBus(created),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error.name === "SequelizeUniqueConstraintError")
      return sendError(res, 409, "A bus with this registration number already exists.");
    next(error);
  }
};

// PUT /api/admin/buses/:id
const updateBus = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const id = parseId(req.params.id);
    if (!id) {
      await transaction.rollback();
      return sendError(res, 400, "Invalid bus ID.");
    }

    const bus = await Bus.findByPk(id, { transaction });
    if (!bus) {
      await transaction.rollback();
      return sendError(res, 404, "Bus not found.");
    }

    const body = req.body || {};
    const errors = validateBusFields(body, { partial: true });

    if (body.status !== undefined && !MANUAL_STATUSES.includes(body.status))
      errors.push(`Status must be one of: ${MANUAL_STATUSES.join(", ")}.`);

    let facilityNames;
    if (body.facilities !== undefined) {
      const result = normalizeFacilities(body.facilities);
      if (result.error) errors.push(result.error);
      else facilityNames = result.list;
    }

    if (errors.length) {
      await transaction.rollback();
      return sendError(res, 400, errors[0], errors);
    }

    const updates = {};

    // Owner change (Bus <-> Owner relationship)
    if (body.ownerId !== undefined && Number(body.ownerId) !== Number(bus.ownerId)) {
      const newOwnerId = parseId(body.ownerId);
      if (!newOwnerId) {
        await transaction.rollback();
        return sendError(res, 400, "A valid ownerId is required.");
      }

      const newOwner = await BusOwner.findByPk(newOwnerId, { transaction });
      if (!newOwner) {
        await transaction.rollback();
        return sendError(res, 404, "Bus owner not found.");
      }
      if (newOwner.status !== "active") {
        await transaction.rollback();
        return sendError(res, 409, "Cannot assign a bus to an inactive bus owner.");
      }
      if ((await countActiveAssignments(bus.id, transaction)) > 0) {
        await transaction.rollback();
        return sendError(
          res,
          409,
          "Cannot change the owner of a bus that has pending or confirmed tour assignments."
        );
      }

      updates.ownerId = newOwnerId;
    }

    if (body.registrationNumber !== undefined) {
      const registrationNumber = body.registrationNumber.trim().toUpperCase();
      if (await registrationInUse(registrationNumber, bus.id)) {
        await transaction.rollback();
        return sendError(res, 409, "A bus with this registration number already exists.");
      }
      updates.registrationNumber = registrationNumber;
    }

    if (body.busName !== undefined) updates.busName = body.busName?.trim() || null;
    if (body.busType !== undefined) updates.busType = body.busType.trim();
    if (body.seatingCapacity !== undefined) updates.seatingCapacity = Number(body.seatingCapacity);
    if (body.airConditioned !== undefined) updates.airConditioned = body.airConditioned;
    if (body.description !== undefined) updates.description = body.description?.trim() || null;

    if (body.status !== undefined && body.status !== bus.status) {
      if (bus.status === "assigned" && (await countActiveAssignments(bus.id, transaction)) > 0) {
        await transaction.rollback();
        return sendError(
          res,
          409,
          "Cannot change the status of a bus that has pending or confirmed tour assignments."
        );
      }
      updates.status = body.status;
    }

    await bus.update(updates, { transaction });
    if (facilityNames !== undefined) await replaceFacilities(bus, facilityNames, transaction);

    await transaction.commit();

    const updated = await findBusWithDetails(bus.id);

    return res.status(200).json({
      success: true,
      message: "Bus updated successfully.",
      data: serializeBus(updated),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error.name === "SequelizeUniqueConstraintError")
      return sendError(res, 409, "A bus with this registration number already exists.");
    next(error);
  }
};

// DELETE /api/admin/buses/:id
const deleteBus = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus ID.");

    const bus = await Bus.findByPk(id);
    if (!bus) return sendError(res, 404, "Bus not found.");

    // Delete protection
    if ((await countActiveAssignments(bus.id)) > 0) {
      return sendError(
        res,
        409,
        "Cannot delete this bus because it has pending or confirmed tour assignments."
      );
    }

    const historyCount = await TourAssignment.count({ where: { busId: bus.id } });
    if (historyCount > 0) {
      return sendError(
        res,
        409,
        "Cannot delete this bus because it appears in tour assignment history. Set the bus status to inactive instead."
      );
    }

    const images = await BusImage.findAll({ where: { busId: bus.id } });

    const transaction = await sequelize.transaction();
    try {
      await BusImage.destroy({ where: { busId: bus.id }, transaction });
      await BusFacility.destroy({ where: { busId: bus.id }, transaction });
      await bus.destroy({ transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Files are removed only after the DB delete succeeded
    await Promise.all(images.map((image) => removeFile(image.fileName)));

    return res.status(200).json({
      success: true,
      message: "Bus deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/buses/:id/availability
// body: { "status": "available" | "unavailable" | "maintenance" | "inactive" }   or   { "isAvailable": true|false }
const updateBusAvailability = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus ID.");

    const bus = await Bus.findByPk(id);
    if (!bus) return sendError(res, 404, "Bus not found.");

    const { status, isAvailable } = req.body || {};

    let nextStatus;
    if (typeof isAvailable === "boolean") {
      nextStatus = isAvailable ? "available" : "inactive";
    } else if (status === "unavailable") {
      nextStatus = "inactive";
    } else if (MANUAL_STATUSES.includes(status)) {
      nextStatus = status;
    } else {
      return sendError(
        res,
        400,
        "Provide isAvailable (true/false) or status (available, unavailable, maintenance, inactive)."
      );
    }

    if (bus.status === "assigned" && (await countActiveAssignments(bus.id)) > 0) {
      return sendError(
        res,
        409,
        "Cannot change availability of a bus that has pending or confirmed tour assignments."
      );
    }

    await bus.update({ status: nextStatus });

    return res.status(200).json({
      success: true,
      message: `Bus is now ${nextStatus}.`,
      data: { id: bus.id, status: bus.status, isAvailable: bus.status === "available" },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/buses/:id/facilities
const getBusFacilities = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus ID.");

    const bus = await Bus.findByPk(id, { attributes: ["id", "airConditioned"] });
    if (!bus) return sendError(res, 404, "Bus not found.");

    const rows = await BusFacility.findAll({ where: { busId: id }, order: [["facilityName", "ASC"]] });

    return res.status(200).json({
      success: true,
      message: "Bus facilities retrieved successfully.",
      data: {
        busId: bus.id,
        airConditioned: bus.airConditioned,
        facilities: rows.map((row) => row.facilityName),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/buses/:id/facilities    body: { facilities: ["Wi-Fi", "USB Charging"], airConditioned?: true }
const updateBusFacilities = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const id = parseId(req.params.id);
    if (!id) {
      await transaction.rollback();
      return sendError(res, 400, "Invalid bus ID.");
    }

    const bus = await Bus.findByPk(id, { transaction });
    if (!bus) {
      await transaction.rollback();
      return sendError(res, 404, "Bus not found.");
    }

    const body = req.body || {};
    const result = normalizeFacilities(body.facilities);
    if (result.error) {
      await transaction.rollback();
      return sendError(res, 400, result.error);
    }

    if (body.airConditioned !== undefined) {
      if (typeof body.airConditioned !== "boolean") {
        await transaction.rollback();
        return sendError(res, 400, "airConditioned must be true or false.");
      }
      await bus.update({ airConditioned: body.airConditioned }, { transaction });
    }

    await replaceFacilities(bus, result.list, transaction);
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Bus facilities updated successfully.",
      data: { busId: bus.id, airConditioned: bus.airConditioned, facilities: result.list },
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

module.exports = {
  getAllBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
  updateBusAvailability,
  getBusFacilities,
  updateBusFacilities,
};
