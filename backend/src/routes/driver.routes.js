
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

// All routes below require Driver authentication
router.use(authenticate);
router.use(authorize("Driver"));

// GET /api/driver/dashboard
router.get("/dashboard", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Driver dashboard access granted.",
    data: {
      user: req.user,
      driverId: req.user.driverId,
      dashboard: "driver",
    },
  });
});

// GET /api/driver/profile
router.get("/profile", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Driver profile retrieved successfully.",
    data: {
      user: req.user,
    },
  });
});

module.exports = router;
