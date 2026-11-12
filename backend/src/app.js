
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");

const environment = require("./config/environment");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const driverRoutes = require("./routes/driver.routes");
const notificationRoutes = require("./routes/notification.routes");
const assignmentActionRoutes = require("./routes/assignment-action.routes");

const notFoundHandler = require("./middleware/notFound.middleware");
const errorHandler = require("./middleware/error.middleware");

const app = express();

// Security headers
app.use(helmet());

// Frontend connection
app.use(
  cors({
    origin: environment.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Request logging
if (environment.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// Request body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parsing
app.use(cookieParser());

// Uploaded files (bus images). CORP header lets the frontend (other origin) display them.
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads"))
);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Bus Pool Management System API.",
  });
});

// API routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/assignment-actions", assignmentActionRoutes);
// Handle unknown routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
