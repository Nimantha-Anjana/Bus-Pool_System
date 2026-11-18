const test = require("node:test");
const assert = require("node:assert");
const { mockRes, SRC } = require("../helpers/setup");
const errorHandler = require(SRC + "middleware/error.middleware");

const run = (error, env = "test") => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  const res = mockRes();
  const { error: e, warn } = console;
  console.error = console.warn = () => {};
  try {
    errorHandler(error, { method: "GET", originalUrl: "/x" }, res, () => {});
  } finally {
    console.error = e; console.warn = warn; process.env.NODE_ENV = previous;
  }
  return res;
};

test("duplicate row -> 409", () => {
  assert.strictEqual(run(Object.assign(new Error("dup"), { name: "SequelizeUniqueConstraintError" })).code, 409);
});
test("foreign key conflict -> 409", () => {
  assert.strictEqual(run(Object.assign(new Error("fk"), { name: "SequelizeForeignKeyConstraintError" })).code, 409);
});
test("invalid JSON body -> 400 even though body-parser also sets statusCode", () => {
  const res = run(Object.assign(new Error("Unexpected token"), { status: 400, statusCode: 400, type: "entity.parse.failed" }));
  assert.strictEqual(res.code, 400);
  assert.strictEqual(res.body.message, "Request body contains invalid JSON.");
});
test("payload too large -> 413", () => {
  assert.strictEqual(run(Object.assign(new Error("big"), { status: 413, type: "entity.too.large" })).code, 413);
});
test("errors with statusCode keep it", () => {
  assert.strictEqual(run(Object.assign(new Error("nope"), { statusCode: 404 })).code, 404);
});
test("database down -> 503", () => {
  assert.strictEqual(run(Object.assign(new Error("db"), { name: "SequelizeConnectionRefusedError" })).code, 503);
});
test("unknown error -> 500, and production hides the details", () => {
  assert.strictEqual(run(new Error("boom")).code, 500);
  const res = run(new Error("secret detail"), "production");
  assert.strictEqual(res.body.message, "Internal server error.");
  assert.strictEqual(res.body.success, false);
});
