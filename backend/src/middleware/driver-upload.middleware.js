const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

// NIC / licence scans are sensitive: they live OUTSIDE the public /uploads folder
// and are only ever served through an authenticated admin endpoint.
const DRIVER_DOCUMENT_DIR = path.join(__dirname, "..", "..", "private_uploads", "driver-documents");
fs.mkdirSync(DRIVER_DOCUMENT_DIR, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DOCUMENT_TYPES = ["nic", "license"];

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DRIVER_DOCUMENT_DIR),
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(8).toString("hex");
    cb(
      null,
      `driver-${req.params.id}-${req.params.type}-${Date.now()}-${random}${EXTENSIONS[file.mimetype]}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      const error = new Error("Only JPG, PNG, WEBP images or PDF files are allowed.");
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

// Field name: "document" (single file)
const uploadDriverDocument = (req, res, next) => {
  upload.single("document")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: "The document must be 5 MB or smaller.",
        LIMIT_FILE_COUNT: "Upload one document at a time.",
        LIMIT_UNEXPECTED_FILE: 'Use the form field name "document".',
      };
      error.statusCode = 400;
      error.message = messages[error.code] || error.message;
    }

    next(error);
  });
};

// Verify the real file content (client-supplied MIME types can be faked)
const MAGIC = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP",
  "application/pdf": (b) => b.slice(0, 5).toString() === "%PDF-",
};

const hasValidSignature = async (fileName, mimeType) => {
  const handle = await fs.promises.open(path.join(DRIVER_DOCUMENT_DIR, path.basename(fileName)), "r");
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, 12, 0);
    return Boolean(MAGIC[mimeType] && MAGIC[mimeType](buffer));
  } finally {
    await handle.close();
  }
};

const removeDriverFile = async (fileName) => {
  if (!fileName) return;
  try {
    await fs.promises.unlink(path.join(DRIVER_DOCUMENT_DIR, path.basename(fileName)));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("File removal failed:", error.message);
  }
};

module.exports = {
  uploadDriverDocument,
  hasValidSignature,
  removeDriverFile,
  DRIVER_DOCUMENT_DIR,
  DOCUMENT_TYPES,
};
