const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");
const authorize = require("../middleware/role.middleware");

const {
  getAllBusOwners,
  getBusOwnerById,
  createBusOwner,
  updateBusOwner,
  deleteBusOwner,
} = require("../controllers/bus-owner.controller");

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

// =====================================================
// BUS OWNER ROUTES
// =====================================================

// GET /api/admin/bus-owners
router.get("/bus-owners", getAllBusOwners);

// GET /api/admin/bus-owners/:id
router.get("/bus-owners/:id", getBusOwnerById);

// POST /api/admin/bus-owners
router.post("/bus-owners", createBusOwner);

// PUT /api/admin/bus-owners/:id
router.put("/bus-owners/:id", updateBusOwner);

// DELETE /api/admin/bus-owners/:id
router.delete("/bus-owners/:id", deleteBusOwner);

module.exports = router;