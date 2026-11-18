
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

// Behind a reverse proxy / load balancer (Nginx, Render, ...) set TRUST_PROXY=1 so that req.ip is the
// real client address (needed by the rate limiters and the activity log).
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(value) ? Number(value) : value === "true" ? true : value);
}

// Security headers
app.use(helmet());

// Frontend connection
app.use(
  cors({
    // Exact-match allow-list (never "*": the refresh cookie needs credentials)
    origin: (origin, callback) => {
      // no Origin header = same-origin / curl / mobile app / e-mail link: not a browser cross-site call
      if (!origin || environment.frontendUrls.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

// Log slow requests (threshold: SLOW_REQUEST_MS, default 1000 ms) so performance problems show up in the logs
app.use((req, res, next) => {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms >= environment.slowRequestMs)
      console.warn(`SLOW REQUEST ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
});

// Request logging (readable in development, standard access-log format elsewhere; silent in tests)
if (environment.nodeEnv === "development") {
  app.use(morgan("dev"));
} else if (environment.nodeEnv !== "test") {
  app.use(morgan("combined"));
}

// Request body parsing
// Every JSON payload in this API is small (uploads use multipart/form-data), so keep the limit low.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

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
// Interactive API documentation (Swagger UI) - disabled in production unless ENABLE_API_DOCS=true
if (environment.enableApiDocs) {
  app.use("/api/docs", require("./routes/docs.routes"));
}

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
