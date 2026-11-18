// Keeps the API documentation honest: every route in src/routes must be described in the OpenAPI file
// (and the other way round), so the docs cannot silently drift away from the code.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { SRC } = require("../helpers/setup");
const spec = require(SRC + "docs/openapi");

const MOUNTS = {
  "health.routes.js": "/api/health",
  "auth.routes.js": "/api/auth",
  "admin.routes.js": "/api/admin",
  "driver.routes.js": "/api/driver",
  "notification.routes.js": "/api/notifications",
  "assignment-action.routes.js": "/api/assignment-actions",
};

const routesInCode = () => {
  const found = new Set();
  for (const [file, prefix] of Object.entries(MOUNTS)) {
    const source = fs.readFileSync(path.join(SRC, "routes", file), "utf8");
    // router.get("/x", ...)   or   router.post(\n  "/x",
    for (const m of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)) {
      const route = `${prefix}${m[2] === "/" ? "" : m[2]}`.replace(/:(\w+)/g, "{$1}");
      found.add(`${m[1].toUpperCase()} ${route}`);
    }
  }
  return found;
};

const routesInSpec = () => {
  const found = new Set();
  for (const [route, operations] of Object.entries(spec.paths))
    for (const method of Object.keys(operations)) found.add(`${method.toUpperCase()} ${route}`);
  return found;
};

test("every route is documented", () => {
  const documented = routesInSpec();
  // path parameter names may differ (:id vs {id}); compare with names normalised
  const normalise = (set) => new Set([...set].map((r) => r.replace(/\{\w+\}/g, "{p}")));
  const docs = normalise(documented);
  const missing = [...routesInCode()].filter((r) => !docs.has(r.replace(/\{\w+\}/g, "{p}")));
  assert.deepStrictEqual(missing, [], `Undocumented routes: ${missing.join(", ")}`);
});

test("the documentation has no routes that do not exist", () => {
  const code = new Set([...routesInCode()].map((r) => r.replace(/\{\w+\}/g, "{p}")));
  const extra = [...routesInSpec()].filter((r) => !code.has(r.replace(/\{\w+\}/g, "{p}")));
  assert.deepStrictEqual(extra, [], `Documented but missing: ${extra.join(", ")}`);
});

test("spec is valid JSON with security and error responses", () => {
  const copy = JSON.parse(JSON.stringify(spec));
  assert.strictEqual(copy.openapi, "3.0.3");
  assert.ok(copy.components.securitySchemes.bearerAuth);
  assert.ok(copy.paths["/api/admin/buses"].get.responses["401"]);
});
