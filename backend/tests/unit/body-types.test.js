const test = require("node:test");
const assert = require("node:assert");
const { mockRes, SRC } = require("../helpers/setup");
const { validateBodyTypes } = require(SRC + "middleware/body-types.middleware");

const run = (body) => {
  const res = mockRes();
  let passed = false;
  validateBodyTypes({ body }, res, () => { passed = true; });
  return { res, passed };
};

test("text fields must be text", () => {
  assert.ok(run({ ownerName: "A", notes: null }).passed);
  assert.ok(run(undefined).passed);
  assert.strictEqual(run({ description: 5 }).res.code, 400);
  assert.strictEqual(run({ email: ["a@b.lk"] }).res.code, 400);
  assert.strictEqual(run({ stops: [{ stopName: "ok" }, { notes: {} }] }).res.code, 400);
});
