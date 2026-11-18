
require("dotenv").config();

const requiredVariables = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const missingVariables = requiredVariables.filter(
  (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing environment variables: ${missingVariables.join(", ")}`
  );
}

if (
  process.env.JWT_ACCESS_SECRET.length < 32 ||
  process.env.JWT_REFRESH_SECRET.length < 32
) {
  throw new Error("JWT secrets must contain at least 32 characters.");
}

const nodeEnv = process.env.NODE_ENV || "development";

// FRONTEND_URL may hold several origins separated by commas (e.g. the site and www.)
const frontendUrls = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Refuse to start in production with obviously unsafe settings
if (nodeEnv === "production") {
  const problems = [];
  const placeholder = /change-?me|example|secret|password/i;

  if (placeholder.test(process.env.JWT_ACCESS_SECRET) || placeholder.test(process.env.JWT_REFRESH_SECRET))
    problems.push("JWT secrets still look like placeholders");
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET)
    problems.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  if (!process.env.FRONTEND_URL || frontendUrls.some((url) => !url.startsWith("https://")))
    problems.push("FRONTEND_URL must be set and use https://");
  if (!process.env.API_PUBLIC_URL || !process.env.API_PUBLIC_URL.startsWith("https://"))
    problems.push("API_PUBLIC_URL must be set and use https:// (it is put inside e-mailed links)");
  if (!process.env.DB_PASSWORD) problems.push("DB_PASSWORD is empty");
  if (!process.env.SMTP_HOST) problems.push("SMTP_HOST is empty (assignment e-mails would never be delivered)");

  if (problems.length)
    throw new Error(`Unsafe production configuration:\n - ${problems.join("\n - ")}`);
}

const environment = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,

  // Refresh-token cookie. "lax" is right when the site and the API share a registrable domain
  // (app.example.lk + api.example.lk). If they are on DIFFERENT domains use COOKIE_SAMESITE=none (needs HTTPS).
  cookie: {
    sameSite: ["lax", "strict", "none"].includes(process.env.COOKIE_SAMESITE) ? process.env.COOKIE_SAMESITE : "lax",
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  frontendUrl: frontendUrls[0],
  frontendUrls,

  // Swagger UI at /api/docs (on by default outside production; set ENABLE_API_DOCS=true to force it on)
  enableApiDocs: process.env.ENABLE_API_DOCS
    ? process.env.ENABLE_API_DOCS === "true"
    : nodeEnv !== "production",

  // Background jobs (reminders, e-mail retry, clean-up). Set RUN_JOBS=false on all but one instance.
  // Requests slower than this (ms) are logged as "SLOW REQUEST"
  slowRequestMs: Number(process.env.SLOW_REQUEST_MS) || 1000,

  runJobs: process.env.RUN_JOBS !== "false",
  reminderHoursBefore: Number(process.env.REMINDER_HOURS_BEFORE) || 48,

  // Webhook (Slack / Discord / any JSON endpoint) that receives every 5xx error, optional
  errorWebhookUrl: process.env.ERROR_WEBHOOK_URL || "",

  // GPS: minimum seconds between two live points of one driver, and what the app should aim for
  gps: {
    minIntervalSeconds: process.env.GPS_MIN_INTERVAL_SECONDS ? Number(process.env.GPS_MIN_INTERVAL_SECONDS) : 5, // 0 = no limit
    recommendedIntervalSeconds: Number(process.env.GPS_RECOMMENDED_INTERVAL_SECONDS) || 15,
    // delete GPS points of finished tours after N days (0 = keep forever)
    retentionDays: Number(process.env.GPS_RETENTION_DAYS) || 0,
  },

  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  timezone: process.env.APP_TIMEZONE || "Asia/Colombo",

  // Public base URL of this API. Used to build the links inside assignment e-mails.
  apiPublicUrl: (
    process.env.API_PUBLIC_URL ||
    `http://localhost:${Number(process.env.PORT) || 5000}`
  ).replace(/\/+$/, ""),

  // How long an e-mailed accept/reject link stays valid
  assignmentTokenExpiresHours:
    Number(process.env.ASSIGNMENT_TOKEN_EXPIRES_HOURS) || 48,

  email: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "Bus Pool <no-reply@buspool.local>",
  },
};

module.exports = environment;
