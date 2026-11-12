const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  Driver,
  User,
  Role,
  DriverDocument,
  TourAssignment,
  RefreshToken,
} = require("../models");
const { removeDriverFile } = require("../middleware/driver-upload.middleware");
const { getToday, isValidDateOnly, addDays } = require("../utils/date.utils");
const {
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidNic,
  isValidLicenseNumber,
  isStrongPassword,
  parseId,
  sendError,
} = require("../utils/validators");

const DRIVER_STATUSES = ["active", "inactive", "suspended"];
const ACTIVE_ASSIGNMENT_STATUSES = ["pending", "confirmed"];
const EXPIRING_SOON_DAYS = 30;
const MAX_LICENSE_YEARS_AHEAD = 15;

const DRIVER_INCLUDES = [
  {
    model: User,
    as: "user",
    attributes: ["id", "firstName", "lastName", "email", "phone", "status", "lastLoginAt"],
  },
  {
    model: DriverDocument,
    as: "documents",
    attributes: ["id", "documentType", "originalName", "mimeType", "fileSize", "createdAt"],
  },
];

const serializeDriver = (driver) => {
  const plain = driver.toJSON();
  const today = getToday();
  const expiry = plain.licenseExpiryDate;

  return {
    ...plain,
    licenseExpired: expiry < today,
    licenseExpiringSoon: expiry >= today && expiry <= addDays(today, EXPIRING_SOON_DAYS),
    documents: (plain.documents || []).map((doc) => ({
      ...doc,
      downloadUrl: `/api/admin/drivers/${plain.id}/documents/${doc.id}/file`,
    })),
  };
};

const findDriverWithDetails = (id, options = {}) =>
  Driver.findByPk(id, { include: DRIVER_INCLUDES, ...options });

const countActiveAssignments = (driverId, transaction) =>
  TourAssignment.count({
    where: { driverId, assignmentStatus: { [Op.in]: ACTIVE_ASSIGNMENT_STATUSES } },
    transaction,
  });

// Licence expiry rules: real date, not expired, not absurdly far ahead
const validateLicenseExpiry = (value) => {
  if (!isValidDateOnly(value)) return "License expiry date must be a valid date (YYYY-MM-DD).";

  const today = getToday();
  if (value < today) return "The driver's license has already expired.";

  const limit = addDays(today, MAX_LICENSE_YEARS_AHEAD * 366);
  if (value > limit) return "License expiry date is too far in the future.";

  return null;
};

const validateDriverFields = (body, { partial }) => {
  const errors = [];
  const has = (key) => body[key] !== undefined;

  if (!partial || has("nic")) {
    if (!isValidNic(body.nic)) errors.push("NIC must be 9 digits followed by V/X, or 12 digits.");
  }

  if (!partial || has("licenseNumber")) {
    if (!isValidLicenseNumber(body.licenseNumber))
      errors.push("License number must be 6-20 letters, digits or hyphens.");
  }

  if (!partial || has("licenseExpiryDate")) {
    const message = validateLicenseExpiry(body.licenseExpiryDate);
    if (message) errors.push(message);
  }

  if (has("emergencyContactPhone") && body.emergencyContactPhone) {
    if (!isValidPhone(body.emergencyContactPhone))
      errors.push("Emergency contact phone is not a valid phone number.");
  }

  if (has("emergencyContactName") && body.emergencyContactName && String(body.emergencyContactName).length > 150)
    errors.push("Emergency contact name must be 150 characters or fewer.");

  return errors;
};

const nicInUse = async (nic, excludeId) =>
  Boolean(
    await Driver.findOne({
      where: { nic, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
      attributes: ["id"],
    })
  );

const licenseInUse = async (licenseNumber, excludeId) =>
  Boolean(
    await Driver.findOne({
      where: { licenseNumber, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
      attributes: ["id"],
    })
  );

const emailInUse = async (email, excludeUserId, transaction) =>
  Boolean(
    await User.findOne({
      where: { email, ...(excludeUserId ? { id: { [Op.ne]: excludeUserId } } : {}) },
      attributes: ["id"],
      transaction,
    })
  );

// GET /api/admin/drivers?status=&search=&licenseExpiry=expired|expiring
const getAllDrivers = async (req, res, next) => {
  try {
    const { status, search, licenseExpiry } = req.query;
    const where = {};
    const today = getToday();

    if (status && DRIVER_STATUSES.includes(status)) where.status = status;

    if (licenseExpiry === "expired") where.licenseExpiryDate = { [Op.lt]: today };
    if (licenseExpiry === "expiring")
      where.licenseExpiryDate = { [Op.between]: [today, addDays(today, EXPIRING_SOON_DAYS)] };

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      where[Op.or] = [
        { nic: { [Op.like]: term } },
        { licenseNumber: { [Op.like]: term } },
        { "$user.first_name$": { [Op.like]: term } },
        { "$user.last_name$": { [Op.like]: term } },
        { "$user.email$": { [Op.like]: term } },
        { "$user.phone$": { [Op.like]: term } },
      ];
    }

    const drivers = await Driver.findAll({
      where,
      include: DRIVER_INCLUDES,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Drivers retrieved successfully.",
      data: drivers.map(serializeDriver),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/drivers/:id
const getDriverById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid driver ID.");

    const driver = await findDriverWithDetails(id);
    if (!driver) return sendError(res, 404, "Driver not found.");

    return res.status(200).json({
      success: true,
      message: "Driver retrieved successfully.",
      data: serializeDriver(driver),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/drivers
// Either link an existing Driver-role user:   { userId, nic, licenseNumber, licenseExpiryDate, ... }
// or create the login account at the same time: { firstName, lastName, email, password, phone?, nic, ... }
const createDriver = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  const fail = async (status, message, errors) => {
    await transaction.rollback();
    return sendError(res, status, message, errors);
  };

  try {
    const body = req.body || {};
    const errors = validateDriverFields(body, { partial: false });

    const linkingExisting = body.userId !== undefined && body.userId !== null;
    const userId = linkingExisting ? parseId(body.userId) : null;

    if (linkingExisting) {
      if (!userId) errors.push("userId must be a valid user ID.");
    } else {
      if (!isNonEmptyString(body.firstName)) errors.push("First name is required.");
      if (!isNonEmptyString(body.lastName)) errors.push("Last name is required.");
      if (!isValidEmail(body.email)) errors.push("A valid email address is required.");
      if (!isStrongPassword(body.password))
        errors.push("Password must be at least 8 characters and contain a letter and a number.");
      if (body.phone && !isValidPhone(body.phone)) errors.push("Phone is not a valid phone number.");
    }

    if (body.status !== undefined && !["active", "inactive"].includes(body.status))
      errors.push("A new driver can only be created as active or inactive.");

    if (errors.length) return fail(400, errors[0], errors);

    const nic = body.nic.trim().toUpperCase();
    const licenseNumber = body.licenseNumber.trim().toUpperCase();

    if (await nicInUse(nic)) return fail(409, "A driver with this NIC already exists.");
    if (await licenseInUse(licenseNumber))
      return fail(409, "A driver with this license number already exists.");

    const status = body.status || "active";
    let user;

    if (linkingExisting) {
      // ---- Driver <-> User account linking ----
      user = await User.findByPk(userId, {
        include: [{ model: Role, as: "role", attributes: ["id", "name"] }],
        transaction,
      });

      if (!user) return fail(404, "User account not found.");
      if (user.role?.name !== "Driver")
        return fail(409, "Only a user with the Driver role can be linked to a driver profile.");

      const alreadyLinked = await Driver.findOne({ where: { userId }, attributes: ["id"], transaction });
      if (alreadyLinked) return fail(409, "This user account is already linked to a driver profile.");
    } else {
      // ---- Create the login account ----
      const email = body.email.trim().toLowerCase();
      if (await emailInUse(email, null, transaction))
        return fail(409, "A user with this email already exists.");

      const [role] = await Role.findOrCreate({
        where: { name: "Driver" },
        defaults: { name: "Driver", description: "Bus driver account" },
        transaction,
      });

      user = await User.create(
        {
          roleId: role.id,
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email,
          passwordHash: await bcrypt.hash(body.password, 12),
          phone: body.phone?.trim() || null,
          status,
        },
        { transaction }
      );
    }

    const driver = await Driver.create(
      {
        userId: user.id,
        nic,
        licenseNumber,
        licenseExpiryDate: body.licenseExpiryDate,
        address: body.address?.trim() || null,
        emergencyContactName: body.emergencyContactName?.trim() || null,
        emergencyContactPhone: body.emergencyContactPhone?.trim() || null,
        status,
      },
      { transaction }
    );

    // keep login status and driver status consistent
    if (user.status !== status) await user.update({ status }, { transaction });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Driver created successfully.",
      data: serializeDriver(await findDriverWithDetails(driver.id)),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error.name === "SequelizeUniqueConstraintError")
      return sendError(res, 409, "NIC, license number or email already exists.");
    next(error);
  }
};

// PUT /api/admin/drivers/:id   (status is changed via PATCH /:id/status)
const updateDriver = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  const fail = async (status, message, errors) => {
    await transaction.rollback();
    return sendError(res, status, message, errors);
  };

  try {
    const id = parseId(req.params.id);
    if (!id) return fail(400, "Invalid driver ID.");

    const driver = await Driver.findByPk(id, { transaction });
    if (!driver) return fail(404, "Driver not found.");

    const user = await User.findByPk(driver.userId, { transaction });
    const body = req.body || {};

    if (body.status !== undefined)
      return fail(400, "Use PATCH /api/admin/drivers/:id/status to change the driver status.");

    const errors = validateDriverFields(body, { partial: true });

    if (body.firstName !== undefined && !isNonEmptyString(body.firstName)) errors.push("First name cannot be empty.");
    if (body.lastName !== undefined && !isNonEmptyString(body.lastName)) errors.push("Last name cannot be empty.");
    if (body.email !== undefined && !isValidEmail(body.email)) errors.push("A valid email address is required.");
    if (body.phone && !isValidPhone(body.phone)) errors.push("Phone is not a valid phone number.");
    if (body.password !== undefined && !isStrongPassword(body.password))
      errors.push("Password must be at least 8 characters and contain a letter and a number.");

    if (errors.length) return fail(400, errors[0], errors);

    const driverUpdates = {};
    const userUpdates = {};

    if (body.nic !== undefined) {
      const nic = body.nic.trim().toUpperCase();
      if (await nicInUse(nic, driver.id)) return fail(409, "A driver with this NIC already exists.");
      driverUpdates.nic = nic;
    }

    if (body.licenseNumber !== undefined) {
      const licenseNumber = body.licenseNumber.trim().toUpperCase();
      if (await licenseInUse(licenseNumber, driver.id))
        return fail(409, "A driver with this license number already exists.");
      driverUpdates.licenseNumber = licenseNumber;
    }

    if (body.licenseExpiryDate !== undefined) driverUpdates.licenseExpiryDate = body.licenseExpiryDate;
    if (body.address !== undefined) driverUpdates.address = body.address?.trim() || null;
    if (body.emergencyContactName !== undefined)
      driverUpdates.emergencyContactName = body.emergencyContactName?.trim() || null;
    if (body.emergencyContactPhone !== undefined)
      driverUpdates.emergencyContactPhone = body.emergencyContactPhone?.trim() || null;

    if (body.firstName !== undefined) userUpdates.firstName = body.firstName.trim();
    if (body.lastName !== undefined) userUpdates.lastName = body.lastName.trim();
    if (body.phone !== undefined) userUpdates.phone = body.phone?.trim() || null;

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (await emailInUse(email, user.id, transaction))
        return fail(409, "A user with this email already exists.");
      userUpdates.email = email;
    }

    // Admin password reset: also logs the driver out everywhere
    if (body.password !== undefined) {
      userUpdates.passwordHash = await bcrypt.hash(body.password, 12);
      userUpdates.tokenVersion = user.tokenVersion + 1;
    }

    await driver.update(driverUpdates, { transaction });
    if (Object.keys(userUpdates).length) await user.update(userUpdates, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Driver updated successfully.",
      data: serializeDriver(await findDriverWithDetails(driver.id)),
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error.name === "SequelizeUniqueConstraintError")
      return sendError(res, 409, "NIC, license number or email already exists.");
    next(error);
  }
};

// PATCH /api/admin/drivers/:id/status   body: { "status": "active" | "inactive" | "suspended" }
const updateDriverStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  const fail = async (status, message) => {
    await transaction.rollback();
    return sendError(res, status, message);
  };

  try {
    const id = parseId(req.params.id);
    if (!id) return fail(400, "Invalid driver ID.");

    const { status } = req.body || {};
    if (!DRIVER_STATUSES.includes(status))
      return fail(400, `Status must be one of: ${DRIVER_STATUSES.join(", ")}.`);

    const driver = await Driver.findByPk(id, { transaction });
    if (!driver) return fail(404, "Driver not found.");

    const user = await User.findByPk(driver.userId, { transaction });

    if (status === "active") {
      if (driver.licenseExpiryDate < getToday())
        return fail(409, "Cannot activate this driver because the license has expired. Update the license expiry date first.");
    } else if (driver.status === "active") {
      if ((await countActiveAssignments(driver.id, transaction)) > 0)
        return fail(409, "Cannot deactivate a driver who has pending or confirmed tour assignments.");
    }

    await driver.update({ status }, { transaction });

    // The login account follows the driver status. Leaving "active" also invalidates
    // every token issued so far, so the driver is signed out immediately.
    await user.update(
      {
        status,
        tokenVersion: status === "active" ? user.tokenVersion : user.tokenVersion + 1,
      },
      { transaction }
    );

    if (status !== "active") await RefreshToken.destroy({ where: { userId: user.id }, transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Driver is now ${status}.`,
      data: { id: driver.id, status: driver.status, userStatus: status },
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

// DELETE /api/admin/drivers/:id[?keepAccount=true]
const deleteDriver = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid driver ID.");

    const driver = await Driver.findByPk(id);
    if (!driver) return sendError(res, 404, "Driver not found.");

    if ((await countActiveAssignments(driver.id)) > 0)
      return sendError(res, 409, "Cannot delete this driver because pending or confirmed tour assignments exist.");

    if ((await TourAssignment.count({ where: { driverId: driver.id } })) > 0)
      return sendError(
        res,
        409,
        "Cannot delete this driver because the driver appears in tour assignment history. Set the driver status to inactive instead."
      );

    const documents = await DriverDocument.findAll({ where: { driverId: driver.id } });
    const user = await User.findByPk(driver.userId, { include: [{ model: Role, as: "role" }] });
    const deleteAccount = req.query.keepAccount !== "true" && user?.role?.name === "Driver";

    const transaction = await sequelize.transaction();
    try {
      await DriverDocument.destroy({ where: { driverId: driver.id }, transaction });
      await driver.destroy({ transaction });

      if (deleteAccount) {
        await RefreshToken.destroy({ where: { userId: user.id }, transaction });
        await user.destroy({ transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();

      if (error.name === "SequelizeForeignKeyConstraintError")
        return sendError(
          res,
          409,
          "Cannot delete this driver because related records exist. Set the driver status to inactive instead."
        );
      throw error;
    }

    await Promise.all(documents.map((doc) => removeDriverFile(doc.fileName)));

    return res.status(200).json({
      success: true,
      message: deleteAccount
        ? "Driver and login account deleted successfully."
        : "Driver deleted successfully. The login account was kept.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  updateDriverStatus,
  deleteDriver,
};
