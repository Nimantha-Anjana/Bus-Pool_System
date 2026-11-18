
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");
const {
  getMyAssignments,
  getMyAssignment,
  acceptAssignment,
  rejectAssignment,
} = require("../controllers/driver-assignment.controller");
const { saveLocation, getGpsConfig } = require("../controllers/gps.controller");
const { validateBodyTypes } = require("../middleware/body-types.middleware");

// All routes below require Driver authentication
router.use(authenticate);
router.use(authorize("Driver"));
router.use(validateBodyTypes);

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

// Assignments sent to this driver
router.get("/assignments", getMyAssignments);
router.get("/assignments/:id", getMyAssignment);
router.post("/assignments/:id/accept", acceptAssignment);
router.post("/assignments/:id/reject", rejectAssignment);

// GPS tracking (confirmed assignment + ongoing tour only)
router.get("/gps/config", getGpsConfig);
router.post("/gps", saveLocation);

module.exports = router;
