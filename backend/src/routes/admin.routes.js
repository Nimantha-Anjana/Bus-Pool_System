
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

// All routes below require Admin authentication
router.use(authenticate);
router.use(authorize("Admin"));

// GET /api/admin/dashboard
router.get("/dashboard", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Admin dashboard access granted.",
    data: {
      user: req.user,
      dashboard: "admin",
    },
  });
});

// GET /api/admin/profile
router.get("/profile", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Admin profile retrieved successfully.",
    data: {
      user: req.user,
    },
  });
});

module.exports = router;
