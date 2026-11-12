const { Op } = require("sequelize");
const { ActivityLog, User } = require("../models");
const { parseDateTime } = require("../utils/date.utils");
const { parseId } = require("../utils/validators");

const MAX_LIMIT = 200;

// GET /api/admin/activity-logs?userId=&action=&entityType=&entityId=&from=&to=&page=&limit=
// `action` matches by prefix, e.g. action=drivers  finds drivers.create, drivers.status.update ...
const getActivityLogs = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);

    const where = {};
    if (parseId(req.query.userId)) where.userId = parseId(req.query.userId);
    if (parseId(req.query.entityId)) where.entityId = parseId(req.query.entityId);
    if (req.query.entityType) where.entityType = String(req.query.entityType).slice(0, 100);
    if (req.query.action) where.action = { [Op.like]: `${String(req.query.action).replace(/[%_]/g, "").slice(0, 100)}%` };

    const from = parseDateTime(req.query.from);
    const to = parseDateTime(req.query.to);
    if (from) where.createdAt = { ...(where.createdAt || {}), [Op.gte]: from };
    if (to) where.createdAt = { ...(where.createdAt || {}), [Op.lte]: to };

    const { rows, count } = await ActivityLog.findAndCountAll({
      where,
      include: [{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email"] }],
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });

    return res.status(200).json({
      success: true,
      message: "Activity logs retrieved successfully.",
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getActivityLogs };
