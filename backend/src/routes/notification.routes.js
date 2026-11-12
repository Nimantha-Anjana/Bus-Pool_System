const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth.middleware");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notification.controller");

// Any logged-in user (Admin or Driver) sees only their own notifications
router.use(authenticate);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

module.exports = router;
