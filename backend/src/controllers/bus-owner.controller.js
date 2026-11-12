const { Op } = require("sequelize");
const { BusOwner, TourAssignment } = require("../models");
const {
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidNic,
  parseId,
  sendError,
} = require("../utils/validators");

const OWNER_STATUSES = ["active", "inactive"];

// Validate a request body. `partial` = true for PUT (only validate fields that were sent).
const validateOwnerPayload = (body, { partial }) => {
  const errors = [];
  const has = (key) => body[key] !== undefined;

  if (!partial || has("ownerName")) {
    if (!isNonEmptyString(body.ownerName)) errors.push("Owner name is required.");
    else if (body.ownerName.trim().length > 150)
      errors.push("Owner name must be 150 characters or fewer.");
  }

  if (!partial || has("phone")) {
    if (!isValidPhone(body.phone))
      errors.push("A valid phone number is required (9-15 digits, optional +).");
  }

  if (!partial || has("email")) {
    if (!isValidEmail(body.email)) errors.push("A valid email address is required.");
  }

  if (has("nic") && body.nic !== null && body.nic !== "") {
    if (!isValidNic(body.nic))
      errors.push("NIC must be 9 digits followed by V/X, or 12 digits.");
  }

  if (has("businessRegistrationNo") && body.businessRegistrationNo) {
    if (String(body.businessRegistrationNo).trim().length > 50)
      errors.push("Business registration number must be 50 characters or fewer.");
  }

  if (has("status") && !OWNER_STATUSES.includes(body.status)) {
    errors.push(`Status must be one of: ${OWNER_STATUSES.join(", ")}.`);
  }

  return errors;
};

// Returns a message if another owner already uses the email / NIC / registration number.
const findDuplicate = async ({ email, nic, businessRegistrationNo }, excludeId) => {
  const checks = [
    [email, "email", "A bus owner with this email already exists."],
    [nic, "nic", "A bus owner with this NIC already exists."],
    [
      businessRegistrationNo,
      "businessRegistrationNo",
      "A bus owner with this business registration number already exists.",
    ],
  ];

  for (const [value, field, message] of checks) {
    if (!value) continue;

    const where = { [field]: value };
    if (excludeId) where.id = { [Op.ne]: excludeId };

    if (await BusOwner.findOne({ where, attributes: ["id"] })) return message;
  }

  return null;
};

// Race-condition safety net: DB unique index fired after our own check passed.
const handleUniqueError = (error, res) => {
  if (error.name === "SequelizeUniqueConstraintError") {
    return sendError(res, 409, "Email, NIC or business registration number already exists.");
  }
  return null;
};

const getAllBusOwners = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};

    if (status && OWNER_STATUSES.includes(status)) where.status = status;

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = [
        { ownerName: { [Op.like]: term } },
        { email: { [Op.like]: term } },
        { phone: { [Op.like]: term } },
        { nic: { [Op.like]: term } },
      ];
    }

    const owners = await BusOwner.findAll({ where, order: [["createdAt", "DESC"]] });

    return res.status(200).json({
      success: true,
      message: "Bus owners retrieved successfully.",
      data: owners,
    });
  } catch (error) {
    next(error);
  }
};

const getBusOwnerById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus owner ID.");

    const owner = await BusOwner.findByPk(id);
    if (!owner) return sendError(res, 404, "Bus owner not found.");

    const busCount = await owner.countBuses();

    return res.status(200).json({
      success: true,
      message: "Bus owner retrieved successfully.",
      data: { ...owner.toJSON(), busCount },
    });
  } catch (error) {
    next(error);
  }
};

const createBusOwner = async (req, res, next) => {
  try {
    const body = req.body || {};

    const errors = validateOwnerPayload(body, { partial: false });
    if (errors.length) return sendError(res, 400, errors[0], errors);

    const data = {
      ownerName: body.ownerName.trim(),
      phone: body.phone.trim(),
      email: body.email.trim().toLowerCase(),
      address: body.address?.trim() || null,
      nic: body.nic ? body.nic.trim().toUpperCase() : null,
      businessRegistrationNo: body.businessRegistrationNo?.trim() || null,
      status: body.status || "active",
      notes: body.notes?.trim() || null,
    };

    const duplicate = await findDuplicate(data);
    if (duplicate) return sendError(res, 409, duplicate);

    const owner = await BusOwner.create(data);

    return res.status(201).json({
      success: true,
      message: "Bus owner created successfully.",
      data: owner,
    });
  } catch (error) {
    if (handleUniqueError(error, res)) return;
    next(error);
  }
};

const updateBusOwner = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus owner ID.");

    const owner = await BusOwner.findByPk(id);
    if (!owner) return sendError(res, 404, "Bus owner not found.");

    const body = req.body || {};

    const errors = validateOwnerPayload(body, { partial: true });
    if (errors.length) return sendError(res, 400, errors[0], errors);

    const updates = {};
    if (body.ownerName !== undefined) updates.ownerName = body.ownerName.trim();
    if (body.phone !== undefined) updates.phone = body.phone.trim();
    if (body.email !== undefined) updates.email = body.email.trim().toLowerCase();
    if (body.address !== undefined) updates.address = body.address?.trim() || null;
    if (body.nic !== undefined) updates.nic = body.nic ? body.nic.trim().toUpperCase() : null;
    if (body.businessRegistrationNo !== undefined)
      updates.businessRegistrationNo = body.businessRegistrationNo?.trim() || null;
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

    const duplicate = await findDuplicate(updates, owner.id);
    if (duplicate) return sendError(res, 409, duplicate);

    await owner.update(updates);

    return res.status(200).json({
      success: true,
      message: "Bus owner updated successfully.",
      data: owner,
    });
  } catch (error) {
    if (handleUniqueError(error, res)) return;
    next(error);
  }
};

const deleteBusOwner = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus owner ID.");

    const owner = await BusOwner.findByPk(id);
    if (!owner) return sendError(res, 404, "Bus owner not found.");

    // Delete protection: owner still has buses
    const busCount = await owner.countBuses();
    if (busCount > 0) {
      return sendError(
        res,
        409,
        `Cannot delete this bus owner because ${busCount} bus(es) are assigned to this owner. Remove or reassign the buses first, or set the owner status to inactive.`
      );
    }

    // Delete protection: owner appears in tour assignment history
    const assignmentCount = await TourAssignment.count({ where: { ownerId: owner.id } });
    if (assignmentCount > 0) {
      return sendError(
        res,
        409,
        "Cannot delete this bus owner because tour assignments exist for this owner. Set the owner status to inactive instead."
      );
    }

    await owner.destroy();

    return res.status(200).json({
      success: true,
      message: "Bus owner deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBusOwners,
  getBusOwnerById,
  createBusOwner,
  updateBusOwner,
  deleteBusOwner,
};
