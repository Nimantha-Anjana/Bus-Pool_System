const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const BUS_IMAGE_DIR = path.join(UPLOAD_ROOT, "buses");

fs.mkdirSync(BUS_IMAGE_DIR, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES_PER_REQUEST = 5;

// Extension is derived from the MIME type, never from the client file name.
const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BUS_IMAGE_DIR),
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(8).toString("hex");
    cb(null, `bus-${req.params.id}-${Date.now()}-${random}${EXTENSIONS[file.mimetype]}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_REQUEST },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      const error = new Error("Only JPG, PNG and WEBP images are allowed.");
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

// Field name: "images" (multiple files)
const uploadBusImages = (req, res, next) => {
  upload.array("images", MAX_FILES_PER_REQUEST)(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: "Each image must be 5 MB or smaller.",
        LIMIT_FILE_COUNT: `You can upload at most ${MAX_FILES_PER_REQUEST} images at a time.`,
        LIMIT_UNEXPECTED_FILE: 'Use the form field name "images".',
      };
      error.statusCode = 400;
      error.message = messages[error.code] || error.message;
    }

    next(error);
  });
};

const removeFile = async (fileName) => {
  if (!fileName) return;
  try {
    // basename() guards against path traversal
    await fs.promises.unlink(path.join(BUS_IMAGE_DIR, path.basename(fileName)));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("File removal failed:", error.message);
  }
};

module.exports = { uploadBusImages, removeFile, BUS_IMAGE_DIR };
