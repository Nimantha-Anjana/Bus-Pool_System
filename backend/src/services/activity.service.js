const { ActivityLog } = require("../models");

// Record who did what. Logging must NEVER break the request, so errors are swallowed.
const logActivity = async ({
  req,
  userId,
  action,
  entityType,
  entityId,
  description,
  transaction,
}) => {
  try {
    await ActivityLog.create(
      {
        userId: userId ?? req?.user?.id ?? null,
        action: String(action).slice(0, 100),
        entityType: entityType ? String(entityType).slice(0, 100) : null,
        entityId: entityId ?? null,
        description: description ? String(description).slice(0, 2000) : null,
        ipAddress: req?.ip ? String(req.ip).slice(0, 45) : null,
        userAgent: req?.headers?.["user-agent"]
          ? String(req.headers["user-agent"]).slice(0, 500)
          : null,
      },
      { transaction }
    );
  } catch (error) {
    console.error("Activity log failed:", error.message);
  }
};

module.exports = { logActivity };
