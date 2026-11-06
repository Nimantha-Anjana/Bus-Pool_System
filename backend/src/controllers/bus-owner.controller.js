const { BusOwner } = require("../models");

const getAllBusOwners = async (req, res, next) => {
  try {
    const owners = await BusOwner.findAll({
      order: [["createdAt", "DESC"]],
    });

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
    const { id } = req.params;

    const owner = await BusOwner.findByPk(id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Bus owner not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bus owner retrieved successfully.",
      data: owner,
    });
  } catch (error) {
    next(error);
  }
};

const createBusOwner = async (req, res, next) => {
  try {
    const {
      ownerName,
      phone,
      email,
      address,
      nic,
      businessRegistrationNo,
      status,
      notes,
    } = req.body || {};

    if (!ownerName || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: "Owner name, phone and email are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingEmail = await BusOwner.findOne({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "A bus owner with this email already exists.",
      });
    }

    if (nic) {
      const existingNic = await BusOwner.findOne({
        where: { nic: nic.trim() },
      });

      if (existingNic) {
        return res.status(409).json({
          success: false,
          message: "A bus owner with this NIC already exists.",
        });
      }
    }

    if (businessRegistrationNo) {
      const existingRegistration = await BusOwner.findOne({
        where: {
          businessRegistrationNo: businessRegistrationNo.trim(),
        },
      });

      if (existingRegistration) {
        return res.status(409).json({
          success: false,
          message:
            "A bus owner with this business registration number already exists.",
        });
      }
    }

    const owner = await BusOwner.create({
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      address: address?.trim() || null,
      nic: nic?.trim() || null,
      businessRegistrationNo:
        businessRegistrationNo?.trim() || null,
      status: status || "active",
      notes: notes?.trim() || null,
    });

    return res.status(201).json({
      success: true,
      message: "Bus owner created successfully.",
      data: owner,
    });
  } catch (error) {
    next(error);
  }
};

const updateBusOwner = async (req, res, next) => {
  try {
    const { id } = req.params;

    const owner = await BusOwner.findByPk(id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Bus owner not found.",
      });
    }

    const {
      ownerName,
      phone,
      email,
      address,
      nic,
      businessRegistrationNo,
      status,
      notes,
    } = req.body || {};

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      const existingEmail = await BusOwner.findOne({
        where: {
          email: normalizedEmail,
        },
      });

      if (existingEmail && existingEmail.id !== owner.id) {
        return res.status(409).json({
          success: false,
          message: "A bus owner with this email already exists.",
        });
      }

      owner.email = normalizedEmail;
    }

    if (nic !== undefined) {
      const normalizedNic = nic?.trim() || null;

      if (normalizedNic) {
        const existingNic = await BusOwner.findOne({
          where: {
            nic: normalizedNic,
          },
        });

        if (existingNic && existingNic.id !== owner.id) {
          return res.status(409).json({
            success: false,
            message: "A bus owner with this NIC already exists.",
          });
        }
      }

      owner.nic = normalizedNic;
    }

    if (businessRegistrationNo !== undefined) {
      const normalizedRegistration =
        businessRegistrationNo?.trim() || null;

      if (normalizedRegistration) {
        const existingRegistration = await BusOwner.findOne({
          where: {
            businessRegistrationNo: normalizedRegistration,
          },
        });

        if (
          existingRegistration &&
          existingRegistration.id !== owner.id
        ) {
          return res.status(409).json({
            success: false,
            message:
              "A bus owner with this business registration number already exists.",
          });
        }
      }

      owner.businessRegistrationNo = normalizedRegistration;
    }

    if (ownerName !== undefined) {
      owner.ownerName = ownerName.trim();
    }

    if (phone !== undefined) {
      owner.phone = phone.trim();
    }

    if (address !== undefined) {
      owner.address = address?.trim() || null;
    }

    if (status !== undefined) {
      owner.status = status;
    }

    if (notes !== undefined) {
      owner.notes = notes?.trim() || null;
    }

    await owner.save();

    return res.status(200).json({
      success: true,
      message: "Bus owner updated successfully.",
      data: owner,
    });
  } catch (error) {
    next(error);
  }
};

const deleteBusOwner = async (req, res, next) => {
  try {
    const { id } = req.params;

    const owner = await BusOwner.findByPk(id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Bus owner not found.",
      });
    }

    const busCount = await owner.countBuses();

    if (busCount > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this bus owner because buses are assigned to this owner. Set the owner status to inactive instead.",
      });
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