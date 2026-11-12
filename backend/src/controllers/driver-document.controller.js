const path = require("path");
const { sequelize } = require("../config/database");
const { Driver, DriverDocument } = require("../models");
const {
  hasValidSignature,
  removeDriverFile,
  DRIVER_DOCUMENT_DIR,
  DOCUMENT_TYPES,
} = require("../middleware/driver-upload.middleware");
const { parseId, sendError } = require("../utils/validators");

const toResponse = (doc) => ({
  id: doc.id,
  driverId: doc.driverId,
  documentType: doc.documentType,
  originalName: doc.originalName,
  mimeType: doc.mimeType,
  fileSize: doc.fileSize,
  createdAt: doc.createdAt,
  downloadUrl: `/api/admin/drivers/${doc.driverId}/documents/${doc.id}/file`,
});

// Runs BEFORE multer: nothing is written to disk for an unknown driver / bad type
const validateUploadRequest = async (req, res, next) => {
  try {
    const driverId = parseId(req.params.id);
    if (!driverId) return sendError(res, 400, "Invalid driver ID.");

    if (!DOCUMENT_TYPES.includes(req.params.type))
      return sendError(res, 400, `Document type must be one of: ${DOCUMENT_TYPES.join(", ")}.`);

    const driver = await Driver.findByPk(driverId, { attributes: ["id"] });
    if (!driver) return sendError(res, 404, "Driver not found.");

    next();
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/drivers/:id/documents
const getDriverDocuments = async (req, res, next) => {
  try {
    const driverId = parseId(req.params.id);
    if (!driverId) return sendError(res, 400, "Invalid driver ID.");

    const driver = await Driver.findByPk(driverId, { attributes: ["id"] });
    if (!driver) return sendError(res, 404, "Driver not found.");

    const docs = await DriverDocument.findAll({ where: { driverId }, order: [["documentType", "ASC"]] });

    return res.status(200).json({
      success: true,
      message: "Driver documents retrieved successfully.",
      data: docs.map(toResponse),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/drivers/:id/documents/:type    (type = nic | license, multipart field "document")
// Uploading again for the same type REPLACES the previous document.
const uploadDriverDocument = async (req, res, next) => {
  const file = req.file;

  try {
    if (!file) return sendError(res, 400, 'No document uploaded. Send the file in the "document" field.');

    const driverId = parseId(req.params.id);
    const documentType = req.params.type;

    if (!(await hasValidSignature(file.filename, file.mimetype))) {
      await removeDriverFile(file.filename);
      return sendError(res, 400, "The file content does not match its type. Upload a real JPG, PNG, WEBP or PDF file.");
    }

    const previous = await DriverDocument.findAll({ where: { driverId, documentType } });

    const transaction = await sequelize.transaction();
    let created;

    try {
      await DriverDocument.destroy({ where: { driverId, documentType }, transaction });

      created = await DriverDocument.create(
        {
          driverId,
          documentType,
          fileName: file.filename,
          originalName: file.originalname.slice(0, 255),
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedBy: req.user.id,
        },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    await Promise.all(previous.map((doc) => removeDriverFile(doc.fileName)));

    return res.status(201).json({
      success: true,
      message: `Driver ${documentType.toUpperCase()} document uploaded successfully.`,
      data: toResponse(created),
    });
  } catch (error) {
    if (file) await removeDriverFile(file.filename);
    next(error);
  }
};

// GET /api/admin/drivers/:id/documents/:docId/file   (Admin token required)
const downloadDriverDocument = async (req, res, next) => {
  try {
    const driverId = parseId(req.params.id);
    const docId = parseId(req.params.docId);
    if (!driverId || !docId) return sendError(res, 400, "Invalid driver or document ID.");

    const doc = await DriverDocument.findOne({ where: { id: docId, driverId } });
    if (!doc) return sendError(res, 404, "Document not found.");

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename="${doc.documentType}-${doc.id}${path.extname(doc.fileName)}"`);

    return res.sendFile(path.join(DRIVER_DOCUMENT_DIR, path.basename(doc.fileName)), (error) => {
      if (error && !res.headersSent) {
        error.statusCode = error.code === "ENOENT" ? 404 : 500;
        error.message = error.code === "ENOENT" ? "Document file is missing on the server." : error.message;
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/drivers/:id/documents/:docId
const deleteDriverDocument = async (req, res, next) => {
  try {
    const driverId = parseId(req.params.id);
    const docId = parseId(req.params.docId);
    if (!driverId || !docId) return sendError(res, 400, "Invalid driver or document ID.");

    const doc = await DriverDocument.findOne({ where: { id: docId, driverId } });
    if (!doc) return sendError(res, 404, "Document not found.");

    const fileName = doc.fileName;
    await doc.destroy();
    await removeDriverFile(fileName);

    return res.status(200).json({ success: true, message: "Driver document deleted successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateUploadRequest,
  getDriverDocuments,
  uploadDriverDocument,
  downloadDriverDocument,
  deleteDriverDocument,
};
