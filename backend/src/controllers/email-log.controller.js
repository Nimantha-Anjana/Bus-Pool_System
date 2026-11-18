const { Op } = require("sequelize");
const { EmailLog } = require("../models");
const { getPagination, buildMeta, getSort } = require("../utils/pagination");
const { parseId, sendError } = require("../utils/validators");
const { parseDateTime } = require("../utils/date.utils");

const SORTABLE = { createdAt: "createdAt", sentAt: "sentAt", deliveryStatus: "deliveryStatus", emailType: "emailType" };
const STATUSES = ["pending", "sent", "failed"];

// GET /api/admin/email-logs?status=failed&type=assignment_request&assignmentId=&recipient=&from=&to=&page=&limit=&sort=&order=
// Delivery history of every assignment e-mail (the e-mail body and the links are never stored).
const getEmailLogs = async (req, res, next) => {
  try {
    const where = {};

    if (req.query.status !== undefined) {
      if (!STATUSES.includes(req.query.status)) return sendError(res, 400, `status must be one of: ${STATUSES.join(", ")}.`);
      where.deliveryStatus = req.query.status;
    }

    if (typeof req.query.type === "string" && req.query.type.trim()) where.emailType = req.query.type.trim().slice(0, 60);

    if (req.query.assignmentId !== undefined) {
      const assignmentId = parseId(req.query.assignmentId);
      if (!assignmentId) return sendError(res, 400, "Invalid assignmentId.");
      where.assignmentId = assignmentId;
    }

    if (typeof req.query.recipient === "string" && req.query.recipient.trim())
      where.recipientEmail = { [Op.like]: `%${req.query.recipient.trim().slice(0, 150)}%` };

    const from = parseDateTime(req.query.from);
    const to = parseDateTime(req.query.to);
    if (req.query.from && !from) return sendError(res, 400, "from is not a valid date/time.");
    if (req.query.to && !to) return sendError(res, 400, "to is not a valid date/time.");
    if (from || to) where.createdAt = { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) };

    const paging = getPagination({ page: 1, limit: 20, ...req.query });
    const order = getSort(req.query, SORTABLE, [["createdAt", "DESC"]]);

    const { rows, count } = await EmailLog.findAndCountAll({
      where,
      order,
      limit: paging.limit,
      offset: paging.offset,
    });

    return res.status(200).json({
      success: true,
      message: "E-mail logs retrieved successfully.",
      data: rows,
      pagination: buildMeta(paging, count),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEmailLogs };
