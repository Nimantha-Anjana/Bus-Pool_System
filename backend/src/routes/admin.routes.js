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

const {
  getAllBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
  updateBusAvailability,
  getBusFacilities,
  updateBusFacilities,
} = require("../controllers/bus.controller");

const {
  ensureBusExists,
  getBusImages,
  uploadBusImages: saveBusImages,
  setPrimaryImage,
  deleteBusImage,
} = require("../controllers/bus-image.controller");

const {
  getDashboard,
  getBusStats,
} = require("../controllers/admin-dashboard.controller");

const { uploadBusImages } = require("../middleware/upload.middleware");

const { auditAdminRequests } = require("../middleware/activity.middleware");

const {
  getAllAssignments,
  getAssignmentById,
  checkAvailability,
  createAssignment,
  updateAssignment,
  resendAssignmentEmails,
  deleteAssignment,
} = require("../controllers/assignment.controller");

const { getBusLocation, getBusGpsHistory } = require("../controllers/gps.controller");
const { getActivityLogs } = require("../controllers/activity-log.controller");

const {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  updateDriverStatus,
  deleteDriver,
} = require("../controllers/driver.controller");

const {
  validateUploadRequest,
  getDriverDocuments,
  uploadDriverDocument: saveDriverDocument,
  downloadDriverDocument,
  deleteDriverDocument,
} = require("../controllers/driver-document.controller");

const { uploadDriverDocument } = require("../middleware/driver-upload.middleware");

const {
  getAllTours,
  getTourById,
  createTour,
  updateTour,
  updateTourStatus,
  deleteTour,
} = require("../controllers/tour.controller");

const {
  getTourStops,
  replaceTourStops,
  addTourStop,
  updateTourStop,
  deleteTourStop,
} = require("../controllers/tour-stop.controller");

// All routes below require Admin authentication
router.use(authenticate);
router.use(authorize("Admin"));

// Every successful admin change is written to the activity log
router.use(auditAdminRequests);

// GET /api/admin/dashboard
router.get("/dashboard", getDashboard);

// GET /api/admin/dashboard/buses
router.get("/dashboard/buses", getBusStats);

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

// =====================================================
// BUS ROUTES
// =====================================================

router.get("/buses", getAllBuses);
router.post("/buses", createBus);
router.get("/buses/:id", getBusById);
router.put("/buses/:id", updateBus);
router.delete("/buses/:id", deleteBus);

// Availability (Available / Unavailable)
router.patch("/buses/:id/availability", updateBusAvailability);

// Facilities
router.get("/buses/:id/facilities", getBusFacilities);
router.put("/buses/:id/facilities", updateBusFacilities);

// Images (multipart/form-data, field name: "images")
router.get("/buses/:id/images", getBusImages);
router.post("/buses/:id/images", ensureBusExists, uploadBusImages, saveBusImages);
router.patch("/buses/:id/images/:imageId/primary", setPrimaryImage);
router.delete("/buses/:id/images/:imageId", deleteBusImage);

// =====================================================
// DRIVER ROUTES
// =====================================================

router.get("/drivers", getAllDrivers);
router.post("/drivers", createDriver);
router.get("/drivers/:id", getDriverById);
router.put("/drivers/:id", updateDriver);
router.delete("/drivers/:id", deleteDriver);

// Activate / Deactivate / Suspend
router.patch("/drivers/:id/status", updateDriverStatus);

// Documents (type = nic | license, multipart field name: "document")
router.get("/drivers/:id/documents", getDriverDocuments);
router.post(
  "/drivers/:id/documents/:type",
  validateUploadRequest,
  uploadDriverDocument,
  saveDriverDocument
);
router.get("/drivers/:id/documents/:docId/file", downloadDriverDocument);
router.delete("/drivers/:id/documents/:docId", deleteDriverDocument);

// =====================================================
// TOUR ROUTES
// =====================================================

router.get("/tours", getAllTours);
router.post("/tours", createTour);
router.get("/tours/:id", getTourById);
router.put("/tours/:id", updateTour);
router.delete("/tours/:id", deleteTour);

// Pending / Scheduled (automatic) -> Ongoing -> Completed / Cancelled
router.patch("/tours/:id/status", updateTourStatus);

// Tour stops (pickup / stop / drop)
router.get("/tours/:id/stops", getTourStops);
router.put("/tours/:id/stops", replaceTourStops);
router.post("/tours/:id/stops", addTourStop);
router.put("/tours/:id/stops/:stopId", updateTourStop);
router.delete("/tours/:id/stops/:stopId", deleteTourStop);

// =====================================================
// ASSIGNMENT ROUTES
// =====================================================

// (availability must stay above /assignments/:id)
router.get("/assignments/availability", checkAvailability);
router.get("/assignments", getAllAssignments);
router.post("/assignments", createAssignment);
router.get("/assignments/:id", getAssignmentById);
router.put("/assignments/:id", updateAssignment);
router.delete("/assignments/:id", deleteAssignment);
router.post("/assignments/:id/resend", resendAssignmentEmails);

// =====================================================
// GPS TRACKING (admin view)
// =====================================================

router.get("/buses/:id/location", getBusLocation);
router.get("/buses/:id/gps-history", getBusGpsHistory);

// =====================================================
// ACTIVITY LOGS
// =====================================================

router.get("/activity-logs", getActivityLogs);

module.exports = router;