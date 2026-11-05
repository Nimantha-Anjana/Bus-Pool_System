
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

const environment = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

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
};

module.exports = environment;
