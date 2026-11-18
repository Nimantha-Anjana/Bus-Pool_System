const express = require("express");

const {
  login,
  refresh,
  logout,
  logoutAllDevices,
  changePassword,
} = require("../controllers/auth.controller");

const { authenticate } = require("../middleware/auth.middleware");
const { createRateLimiter } = require("../middleware/rate-limit.middleware");

const router = express.Router();

// Brute-force protection: 10 login attempts / minute / IP, 30 refreshes / minute / IP
const loginLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });
const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

router.post("/login", loginLimiter, login);

router.post("/refresh", refreshLimiter, refresh);

router.post("/logout", logout);

router.post("/logout-all", authenticate, logoutAllDevices);

router.post("/change-password", authenticate, changePassword);

module.exports = router;
