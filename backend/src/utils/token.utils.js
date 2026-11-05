
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const environment = require("../config/environment");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role.name,
      tokenVersion: user.tokenVersion,
    },
    environment.jwt.accessSecret,
    {
      expiresIn: environment.jwt.accessExpiresIn,
      issuer: "bus-pool-system",
      audience: "bus-pool-system-users",
    }
  );
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const getDurationMs = (duration) => {
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match) {
    throw new Error("Invalid JWT duration configuration.");
  }

  const value = Number(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, environment.jwt.accessSecret, {
    issuer: "bus-pool-system",
    audience: "bus-pool-system-users",
  });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, environment.jwt.refreshSecret, {
    issuer: "bus-pool-system",
    audience: "bus-pool-system-refresh",
  });
};

const createRefreshJwt = (user) => {
  return jwt.sign(
    {
      sub: String(user.id),
      type: "refresh",
      tokenVersion: user.tokenVersion,
    },
    environment.jwt.refreshSecret,
    {
      expiresIn: environment.jwt.refreshExpiresIn,
      issuer: "bus-pool-system",
      audience: "bus-pool-system-refresh",
    }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getDurationMs,
  verifyAccessToken,
  verifyRefreshToken,
  createRefreshJwt,
};
