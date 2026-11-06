const express = require("express");

const {
  login,
  refresh,
  logout,
  logoutAllDevices,
  changePassword,
} = require("../controllers/auth.controller");

const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", login);

router.post("/refresh", refresh);

router.post("/logout", logout);

router.post("/logout-all", authenticate, logoutAllDevices);

router.post("/change-password", authenticate, changePassword);

module.exports = router;
