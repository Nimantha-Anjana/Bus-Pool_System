
const express = require("express");

const {
  login,
  refresh,
  logout,
  changePassword,
} = require("../controllers/auth.controller");

const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", login);

router.post("/refresh", refresh);

router.post("/logout", logout);

router.post("/change-password", authenticate, changePassword);

module.exports = router;
