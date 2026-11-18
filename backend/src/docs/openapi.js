// OpenAPI 3.0 description of the API. Built from a compact table so it stays easy to keep in sync with the routes.
// Served at /api/docs (Swagger UI) and /api/docs/openapi.json when ENABLE_API_DOCS is on.

const TYPES = {
  string: { type: "string" },
  email: { type: "string", format: "email" },
  password: { type: "string", format: "password", minLength: 8, maxLength: 72 },
  int: { type: "integer" },
  number: { type: "number" },
  bool: { type: "boolean" },
  date: { type: "string", format: "date-time" },
  day: { type: "string", format: "date" },
  json: { type: "object" },
  strings: { type: "array", items: { type: "string" } },
  objects: { type: "array", items: { type: "object" } },
};

// obj({ name: "string!", age: "int", status: ["a","b"] })   "!" = required, array = enum
const obj = (fields) => {
  const properties = {};
  const required = [];
  for (const [name, spec] of Object.entries(fields)) {
    const isRequired = typeof spec === "string" && spec.endsWith("!");
    const key = typeof spec === "string" ? spec.replace("!", "") : null;
    properties[name] = Array.isArray(spec) ? { type: "string", enum: spec } : TYPES[key];
    if (isRequired) required.push(name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
};

const paths = {};
const tags = new Set();

const ID = { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } };
const param = (name, schema = { type: "string" }, description) => ({ name, in: "query", required: false, schema, description });

const PAGING = [
  param("page", { type: "integer", minimum: 1 }, "Optional. Without page/limit every row is returned."),
  param("limit", { type: "integer", minimum: 1, maximum: 100 }, "Optional page size (default 20, max 100)."),
];

const sortParams = (fields) => [
  param("sort", { type: "string", enum: fields }, "Field to sort by."),
  param("order", { type: "string", enum: ["asc", "desc"] }, "Sort direction (default depends on the endpoint)."),
];

// auth: "none" | "user" (any logged-in user) | "admin" | "driver"
const ep = (method, path, tag, summary, { auth = "admin", body, query = [], list = false, sort, params = true, responses = {}, multipart } = {}) => {
  tags.add(tag);
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: m[1] === "token" ? { type: "string" } : m[1] === "type" ? { type: "string", enum: ["nic", "license"] } : { type: "integer", minimum: 1 },
  }));

  const operation = {
    tags: [tag],
    summary,
    ...(auth === "none" ? { security: [] } : { security: [{ bearerAuth: [] }] }),
    parameters: [...(params ? pathParams : []), ...query, ...(list ? PAGING : []), ...(sort ? sortParams(sort) : [])],
    responses: {
      200: { description: "Success", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
      ...(auth !== "none" ? { 401: { $ref: "#/components/responses/Unauthorized" } } : {}),
      ...(auth === "admin" || auth === "driver" ? { 403: { $ref: "#/components/responses/Forbidden" } } : {}),
      400: { $ref: "#/components/responses/BadRequest" },
      ...(pathParams.length ? { 404: { $ref: "#/components/responses/NotFound" } } : {}),
      ...(method === "post" || method === "put" || method === "patch" || method === "delete" ? { 409: { $ref: "#/components/responses/Conflict" } } : {}),
      500: { $ref: "#/components/responses/ServerError" },
      ...responses,
    },
  };

  if (body) operation.requestBody = { required: true, content: { "application/json": { schema: body } } };
  if (multipart) operation.requestBody = { required: true, content: { "multipart/form-data": { schema: multipart } } };

  (paths[path] ||= {})[method] = operation;
};

// ---- Schemas ----------------------------------------------------------------------------------------------
const owner = { ownerName: "string!", phone: "string!", email: "email!", address: "string", nic: "string", businessRegistrationNo: "string", status: ["active", "inactive"], notes: "string" };
const bus = { ownerId: "int!", registrationNumber: "string!", busName: "string", busType: "string!", seatingCapacity: "int!", airConditioned: "bool", description: "string", status: ["available", "assigned", "maintenance", "inactive"], facilities: "strings" };
const driver = { userId: "int", firstName: "string", lastName: "string", email: "email", password: "password", phone: "string", nic: "string!", licenseNumber: "string!", licenseExpiryDate: "day!", address: "string", emergencyContactName: "string", emergencyContactPhone: "string", status: ["active", "inactive", "suspended"] };
const stop = { stopName: "string!", stopType: ["pickup", "stop", "drop"], locationAddress: "string", latitude: "number", longitude: "number", stopOrder: "int", plannedArrivalAt: "date", notes: "string" };
const tour = { tourCode: "string", tourName: "string!", tourType: ["local", "foreign"], description: "string", startLocation: "string!", destination: "string!", startAt: "date!", endAt: "date!", pickupAt: "date", returnAt: "date", passengerCount: "int!", specialNotes: "string", stops: "objects" };
const assignment = { tourId: "int!", busId: "int!", driverId: "int!", assignedStartAt: "date", assignedEndAt: "date" };
const gpsPoint = { assignmentId: "int", latitude: "number!", longitude: "number!", accuracy: "number", speed: "number", heading: "number", recordedAt: "date" };

// ---- Health & auth ----------------------------------------------------------------------------------------
ep("get", "/api/health", "Health", "API and database health check", { auth: "none" });
ep("post", "/api/auth/login", "Auth", "Login (admin or driver). Returns an access token; sets the HTTP-only refresh cookie", { auth: "none", body: obj({ email: "email!", password: "string!" }), responses: { 429: { description: "Too many attempts" } } });
ep("post", "/api/auth/refresh", "Auth", "Get a new access token using the refresh cookie (the refresh token rotates)", { auth: "none" });
ep("post", "/api/auth/logout", "Auth", "Logout this device", { auth: "none" });
ep("post", "/api/auth/logout-all", "Auth", "Logout from all devices", { auth: "user" });
ep("post", "/api/auth/change-password", "Auth", "Change password (logs out all devices)", { auth: "user", body: obj({ currentPassword: "string!", newPassword: "password!" }) });

// ---- Admin ------------------------------------------------------------------------------------------------
ep("get", "/api/admin/dashboard", "Admin dashboard", "Dashboard statistics");
ep("get", "/api/admin/dashboard/buses", "Admin dashboard", "Bus statistics");
ep("get", "/api/admin/profile", "Admin dashboard", "Logged-in admin profile");

ep("get", "/api/admin/bus-owners", "Bus owners", "List bus owners", { list: true, sort: ["ownerName", "email", "status", "createdAt"], query: [param("status", { type: "string", enum: ["active", "inactive"] }), param("search")] });
ep("post", "/api/admin/bus-owners", "Bus owners", "Create bus owner", { body: obj(owner) });
ep("get", "/api/admin/bus-owners/{id}", "Bus owners", "Get bus owner");
ep("put", "/api/admin/bus-owners/{id}", "Bus owners", "Update bus owner (cannot be deactivated while assignments are active)", { body: obj(owner) });
ep("delete", "/api/admin/bus-owners/{id}", "Bus owners", "Delete bus owner (blocked while buses or assignments exist)");

ep("get", "/api/admin/buses", "Buses", "List buses", { list: true, sort: ["registrationNumber", "busName", "busType", "seatingCapacity", "status", "createdAt"], query: [param("status"), param("ownerId", { type: "integer" }), param("search"), param("airConditioned", { type: "boolean" })] });
ep("post", "/api/admin/buses", "Buses", "Create bus", { body: obj(bus) });
ep("get", "/api/admin/buses/{id}", "Buses", "Get bus");
ep("put", "/api/admin/buses/{id}", "Buses", "Update bus", { body: obj(bus) });
ep("delete", "/api/admin/buses/{id}", "Buses", "Delete bus");
ep("patch", "/api/admin/buses/{id}/availability", "Buses", "Set bus availability", { body: obj({ status: ["available", "unavailable", "maintenance", "inactive"], isAvailable: "bool" }) });
ep("get", "/api/admin/buses/{id}/facilities", "Buses", "List bus facilities");
ep("put", "/api/admin/buses/{id}/facilities", "Buses", "Replace bus facilities", { body: obj({ facilities: "strings!" }) });
ep("get", "/api/admin/buses/{id}/images", "Buses", "List bus images");
ep("post", "/api/admin/buses/{id}/images", "Buses", "Upload bus images (JPG/PNG/WEBP, content is verified)", { multipart: { type: "object", properties: { images: { type: "array", items: { type: "string", format: "binary" } } } } });
ep("patch", "/api/admin/buses/{id}/images/{imageId}/primary", "Buses", "Set primary image");
ep("delete", "/api/admin/buses/{id}/images/{imageId}", "Buses", "Delete image");

ep("get", "/api/admin/drivers", "Drivers", "List drivers", { list: true, sort: ["licenseExpiryDate", "status", "nic", "createdAt"], query: [param("status"), param("search"), param("licenseExpiry", { type: "string", enum: ["expired", "expiring"] })] });
ep("post", "/api/admin/drivers", "Drivers", "Create driver (new user account, or link an existing user with userId)", { body: obj(driver) });
ep("get", "/api/admin/drivers/{id}", "Drivers", "Get driver");
ep("put", "/api/admin/drivers/{id}", "Drivers", "Update driver", { body: obj(driver) });
ep("delete", "/api/admin/drivers/{id}", "Drivers", "Delete driver", { query: [param("keepAccount", { type: "boolean" })] });
ep("patch", "/api/admin/drivers/{id}/status", "Drivers", "Change driver status", { body: obj({ status: ["active", "inactive", "suspended"] }) });
ep("get", "/api/admin/drivers/{id}/documents", "Drivers", "List NIC / licence documents");
ep("post", "/api/admin/drivers/{id}/documents/{type}", "Drivers", "Upload the NIC or licence scan (multipart field \"document\"; content is verified; replaces the previous one)", { multipart: { type: "object", properties: { document: { type: "string", format: "binary" } } } });
ep("get", "/api/admin/drivers/{id}/documents/{docId}/file", "Drivers", "Download a document (admin only)");
ep("delete", "/api/admin/drivers/{id}/documents/{docId}", "Drivers", "Delete a document");

ep("get", "/api/admin/tours", "Tours", "List tours", { list: true, sort: ["startAt", "endAt", "tourName", "passengerCount", "status", "createdAt"], query: [param("status", { type: "string", enum: ["pending", "scheduled", "planned", "ongoing", "completed", "cancelled"] }), param("tourType", { type: "string", enum: ["local", "foreign"] }), param("search"), param("from", { type: "string", format: "date-time" }), param("to", { type: "string", format: "date-time" })] });
ep("post", "/api/admin/tours", "Tours", "Create tour (optionally with stops)", { body: obj(tour) });
ep("get", "/api/admin/tours/{id}", "Tours", "Get tour with stops and assignments");
ep("put", "/api/admin/tours/{id}", "Tours", "Update tour", { body: obj(tour) });
ep("delete", "/api/admin/tours/{id}", "Tours", "Delete tour");
ep("patch", "/api/admin/tours/{id}/status", "Tours", "Change tour status (planned → ongoing → completed, or cancelled)", { body: obj({ status: ["planned", "ongoing", "completed", "cancelled"] }) });
ep("get", "/api/admin/tours/{id}/stops", "Tour stops", "List stops");
ep("put", "/api/admin/tours/{id}/stops", "Tour stops", "Replace all stops", { body: obj({ stops: "objects!" }) });
ep("post", "/api/admin/tours/{id}/stops", "Tour stops", "Add a stop", { body: obj(stop) });
ep("put", "/api/admin/tours/{id}/stops/{stopId}", "Tour stops", "Update a stop", { body: obj(stop) });
ep("delete", "/api/admin/tours/{id}/stops/{stopId}", "Tour stops", "Delete a stop");

ep("get", "/api/admin/assignments/availability", "Assignments", "Which buses and drivers are free for a tour / time window", { query: [param("tourId", { type: "integer" }), param("from", { type: "string", format: "date-time" }), param("to", { type: "string", format: "date-time" }), param("excludeAssignmentId", { type: "integer" })] });
ep("get", "/api/admin/assignments", "Assignments", "List assignments", { list: true, sort: ["assignedStartAt", "assignedEndAt", "assignmentStatus", "createdAt"], query: [param("status"), param("tourId", { type: "integer" }), param("busId", { type: "integer" }), param("driverId", { type: "integer" }), param("ownerId", { type: "integer" }), param("from", { type: "string", format: "date-time" }), param("to", { type: "string", format: "date-time" })] });
ep("post", "/api/admin/assignments", "Assignments", "Assign bus + driver to a tour (overlaps are rejected; e-mails are sent)", { body: obj(assignment) });
ep("get", "/api/admin/assignments/{id}", "Assignments", "Get assignment");
ep("put", "/api/admin/assignments/{id}", "Assignments", "Change bus / driver / window (re-assign after a rejection), or cancel with assignmentStatus=cancelled", { body: obj({ ...assignment, assignmentStatus: ["cancelled"] }) });
ep("delete", "/api/admin/assignments/{id}", "Assignments", "Delete assignment");
ep("post", "/api/admin/assignments/{id}/resend", "Assignments", "Issue new response links and resend the e-mails");

ep("get", "/api/admin/gps/live", "GPS", "Latest position of every bus that is on a tour right now (for the map)");
ep("get", "/api/admin/buses/{id}/location", "GPS", "Latest known location of a bus");
ep("get", "/api/admin/buses/{id}/gps-history", "GPS", "GPS history of a bus", { query: [param("from", { type: "string", format: "date-time" }), param("to", { type: "string", format: "date-time" }), param("assignmentId", { type: "integer" }), param("order", { type: "string", enum: ["asc", "desc"] }), param("limit", { type: "integer", maximum: 5000 })] });

ep("get", "/api/admin/activity-logs", "Logs", "Activity (audit) log", { query: [param("userId", { type: "integer" }), param("action", { type: "string" }, "Prefix match, e.g. drivers or auth"), param("entityType"), param("entityId", { type: "integer" }), param("from", { type: "string", format: "date-time" }), param("to", { type: "string", format: "date-time" }), param("page", { type: "integer" }), param("limit", { type: "integer", maximum: 200 })] });
ep("get", "/api/admin/email-logs", "Logs", "E-mail delivery log", { list: true, sort: ["createdAt", "sentAt", "deliveryStatus", "emailType"], query: [param("status", { type: "string", enum: ["pending", "sent", "failed"] }), param("type"), param("assignmentId", { type: "integer" }), param("recipient"), param("from", { type: "string", format: "date-time" }), param("to", { type: "string", format: "date-time" })] });

// ---- Driver -----------------------------------------------------------------------------------------------
ep("get", "/api/driver/dashboard", "Driver", "Driver dashboard", { auth: "driver" });
ep("get", "/api/driver/profile", "Driver", "Driver profile", { auth: "driver" });
ep("get", "/api/driver/assignments", "Driver", "My assignments", { auth: "driver", query: [param("status")] });
ep("get", "/api/driver/assignments/{id}", "Driver", "One of my assignments", { auth: "driver" });
ep("post", "/api/driver/assignments/{id}/accept", "Driver", "Accept an assignment", { auth: "driver" });
ep("post", "/api/driver/assignments/{id}/reject", "Driver", "Reject an assignment", { auth: "driver", body: obj({ reason: "string" }) });
ep("get", "/api/driver/gps/config", "GPS", "Can I send GPS now, and how often?", { auth: "driver" });
ep("post", "/api/driver/gps", "GPS", "Send one point, or { points: [...] } up to 100 (own confirmed assignment, tour ongoing). Single points faster than the minimum interval get 429 + Retry-After", { auth: "driver", body: { oneOf: [obj(gpsPoint), obj({ assignmentId: "int", points: "objects!" })] }, responses: { 429: { description: "Too frequent" } } });

// ---- Notifications ----------------------------------------------------------------------------------------
ep("get", "/api/notifications", "Notifications", "My notifications (history)", { auth: "user", query: [param("unread", { type: "boolean" }), param("page", { type: "integer" }), param("limit", { type: "integer", maximum: 100 })] });
ep("get", "/api/notifications/unread-count", "Notifications", "Unread count", { auth: "user" });
ep("patch", "/api/notifications/read-all", "Notifications", "Mark all as read", { auth: "user" });
ep("patch", "/api/notifications/{id}/read", "Notifications", "Mark one as read", { auth: "user" });
ep("delete", "/api/notifications/{id}", "Notifications", "Delete a notification", { auth: "user" });

// ---- Public e-mail links ----------------------------------------------------------------------------------
ep("get", "/api/assignment-actions/{token}", "Assignment links", "Preview an assignment from an e-mailed single-use token (does not use the token)", { auth: "none" });
ep("get", "/api/assignment-actions/{token}/page", "Assignment links", "HTML page opened from the e-mail", { auth: "none" });
ep("post", "/api/assignment-actions/respond", "Assignment links", "Accept / reject with the token (JSON)", { auth: "none", body: obj({ token: "string!", response: ["accepted", "rejected"], reason: "string" }) });
ep("post", "/api/assignment-actions/respond-form", "Assignment links", "Accept / reject from the HTML page (form post)", { auth: "none" });

const errorResponse = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Bus Pool System API",
    version: "1.0.0",
    description:
      "All responses use `{ success, message, data }`; lists may add `pagination: { page, limit, total, totalPages }`; errors use `{ success: false, message }`.\n\n" +
      "Authentication: `POST /api/auth/login` returns an access token (send it as `Authorization: Bearer <token>`); the refresh token is an HTTP-only cookie used by `POST /api/auth/refresh`. Admin routes need the Admin role, driver routes the Driver role.",
  },
  servers: [{ url: "/" }],
  tags: [...tags].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Success: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Buses retrieved successfully." },
          data: {},
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      Pagination: { type: "object", properties: { page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" } } },
      Error: { type: "object", properties: { success: { type: "boolean", example: false }, message: { type: "string" } } },
    },
    responses: {
      BadRequest: errorResponse("Invalid input / invalid ID"),
      Unauthorized: errorResponse("Missing, invalid or expired access token"),
      Forbidden: errorResponse("The role is not allowed to use this endpoint"),
      NotFound: errorResponse("Record not found"),
      Conflict: errorResponse("Duplicate data, overlap or the action conflicts with the current state"),
      ServerError: errorResponse("Unexpected server error"),
    },
  },
};

module.exports = spec;
