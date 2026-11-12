const { logActivity } = require("../services/activity.service");

const VERBS = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

// Writes one activity-log row for every SUCCESSFUL admin change (POST / PUT / PATCH / DELETE).
// Request bodies are never logged (they can contain passwords).
//   PUT    /api/admin/buses/12            -> buses.update      (entity buses #12)
//   PATCH  /api/admin/drivers/5/status    -> drivers.status.update
//   POST   /api/admin/assignments         -> assignments.create (id taken from the response)
const auditAdminRequests = (req, res, next) => {
  const verb = VERBS[req.method];
  if (!verb) return next();

  let responseBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (res.statusCode >= 400 || !req.user) return;

    const parts = req.path.split("/").filter(Boolean);
    if (!parts.length) return;

    const resource = parts[0];
    const hasId = /^\d+$/.test(parts[1] || "");
    const entityId = hasId ? Number(parts[1]) : responseBody?.data?.id ?? null;
    const sub = parts.slice(hasId ? 2 : 1).find((part) => !/^\d+$/.test(part));

    logActivity({
      req,
      action: [resource, sub, verb].filter(Boolean).join("."),
      entityType: resource,
      entityId: Number.isInteger(Number(entityId)) ? Number(entityId) : null,
      description: `${req.method} /api/admin${req.path} (HTTP ${res.statusCode})`,
    });
  });

  next();
};

module.exports = { auditAdminRequests };
