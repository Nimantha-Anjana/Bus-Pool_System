const { Notification } = require("../models");
const { parseId, sendError } = require("../utils/validators");

const MAX_LIMIT = 100;

// Every query is scoped to the logged-in user, so nobody can read or delete someone else's notifications.

// GET /api/notifications?unread=true&page=1&limit=20
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), MAX_LIMIT);

    const where = { userId: req.user.id };
    if (req.query.unread === "true") where.isRead = false;

    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully.",
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.count({ where: { userId: req.user.id, isRead: false } });

    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully.",
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid notification ID.");

    const notification = await Notification.findOne({ where: { id, userId: req.user.id } });
    if (!notification) return sendError(res, 404, "Notification not found.");

    if (!notification.isRead) await notification.update({ isRead: true, readAt: new Date() });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res, next) => {
  try {
    const [updated] = await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      data: { updated },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return sendError(res, 400, "Invalid notification ID.");

    const deleted = await Notification.destroy({ where: { id, userId: req.user.id } });
    if (!deleted) return sendError(res, 404, "Notification not found.");

    return res.status(200).json({ success: true, message: "Notification deleted successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification };
