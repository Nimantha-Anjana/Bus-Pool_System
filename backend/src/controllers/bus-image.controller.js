const { sequelize } = require("../config/database");
const { Bus, BusImage } = require("../models");
const { removeFile } = require("../middleware/upload.middleware");
const { parseId, sendError } = require("../utils/validators");

const MAX_IMAGES_PER_BUS = 10;

// Keep buses.image_url pointing at the primary image
const syncPrimaryImage = async (bus, transaction) => {
  const primary = await BusImage.findOne({
    where: { busId: bus.id, isPrimary: true },
    transaction,
  });
  await bus.update({ imageUrl: primary ? primary.imageUrl : null }, { transaction });
};

// Runs BEFORE multer so nothing is written to disk for a bus that does not exist
const ensureBusExists = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus ID.");

    const bus = await Bus.findByPk(id, { attributes: ["id"] });
    if (!bus) return sendError(res, 404, "Bus not found.");

    next();
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/buses/:id/images
const getBusImages = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid bus ID.");

    const bus = await Bus.findByPk(id, { attributes: ["id"] });
    if (!bus) return sendError(res, 404, "Bus not found.");

    const images = await BusImage.findAll({
      where: { busId: id },
      order: [["isPrimary", "DESC"], ["createdAt", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Bus images retrieved successfully.",
      data: images,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/buses/:id/images   (multipart/form-data, field "images")
const uploadBusImages = async (req, res, next) => {
  const files = req.files || [];

  const discardUploads = () => Promise.all(files.map((file) => removeFile(file.filename)));

  try {
    if (files.length === 0) {
      return sendError(res, 400, 'No image uploaded. Send files in the "images" field.');
    }

    const bus = await Bus.findByPk(parseId(req.params.id));
    if (!bus) {
      await discardUploads();
      return sendError(res, 404, "Bus not found.");
    }

    const existingCount = await BusImage.count({ where: { busId: bus.id } });
    if (existingCount + files.length > MAX_IMAGES_PER_BUS) {
      await discardUploads();
      return sendError(
        res,
        409,
        `A bus can have at most ${MAX_IMAGES_PER_BUS} images (currently ${existingCount}).`
      );
    }

    const transaction = await sequelize.transaction();
    let created;

    try {
      const hasPrimary = await BusImage.count({
        where: { busId: bus.id, isPrimary: true },
        transaction,
      });

      created = await BusImage.bulkCreate(
        files.map((file, index) => ({
          busId: bus.id,
          fileName: file.filename,
          imageUrl: `/uploads/buses/${file.filename}`,
          originalName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          fileSize: file.size,
          // first image of a bus becomes the primary image
          isPrimary: !hasPrimary && index === 0,
        })),
        { transaction }
      );

      await syncPrimaryImage(bus, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: `${created.length} image(s) uploaded successfully.`,
      data: created,
    });
  } catch (error) {
    await discardUploads();
    next(error);
  }
};

// PATCH /api/admin/buses/:id/images/:imageId/primary
const setPrimaryImage = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const busId = parseId(req.params.id);
    const imageId = parseId(req.params.imageId);
    if (!busId || !imageId) {
      await transaction.rollback();
      return sendError(res, 400, "Invalid bus or image ID.");
    }

    const bus = await Bus.findByPk(busId, { transaction });
    const image = await BusImage.findOne({ where: { id: imageId, busId }, transaction });

    if (!bus || !image) {
      await transaction.rollback();
      return sendError(res, 404, "Bus image not found.");
    }

    await BusImage.update({ isPrimary: false }, { where: { busId }, transaction });
    await image.update({ isPrimary: true }, { transaction });
    await syncPrimaryImage(bus, transaction);

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Primary image updated successfully.",
      data: image,
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

// DELETE /api/admin/buses/:id/images/:imageId
const deleteBusImage = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const busId = parseId(req.params.id);
    const imageId = parseId(req.params.imageId);
    if (!busId || !imageId) {
      await transaction.rollback();
      return sendError(res, 400, "Invalid bus or image ID.");
    }

    const bus = await Bus.findByPk(busId, { transaction });
    const image = await BusImage.findOne({ where: { id: imageId, busId }, transaction });

    if (!bus || !image) {
      await transaction.rollback();
      return sendError(res, 404, "Bus image not found.");
    }

    const wasPrimary = image.isPrimary;
    const fileName = image.fileName;

    await image.destroy({ transaction });

    // If the primary image was removed, promote the oldest remaining image
    if (wasPrimary) {
      const nextImage = await BusImage.findOne({
        where: { busId },
        order: [["createdAt", "ASC"]],
        transaction,
      });
      if (nextImage) await nextImage.update({ isPrimary: true }, { transaction });
    }

    await syncPrimaryImage(bus, transaction);
    await transaction.commit();

    await removeFile(fileName);

    return res.status(200).json({
      success: true,
      message: "Bus image deleted successfully.",
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    next(error);
  }
};

module.exports = {
  ensureBusExists,
  getBusImages,
  uploadBusImages,
  setPrimaryImage,
  deleteBusImage,
};
