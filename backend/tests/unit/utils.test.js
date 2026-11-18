const test = require("node:test");
const assert = require("node:assert");
const { SRC } = require("../helpers/setup");
const { parseDateTime } = require(SRC + "utils/date.utils");
const { getPagination, buildMeta, getSort } = require(SRC + "utils/pagination");

test("parseDateTime accepts ISO strings and valid Dates only", () => {
  assert.strictEqual(parseDateTime("2026-12-01T10:00:00Z").toISOString(), "2026-12-01T10:00:00.000Z");
  assert.ok(parseDateTime(new Date()) instanceof Date);
  assert.strictEqual(parseDateTime(new Date("nope")), null);
  assert.strictEqual(parseDateTime(""), null);
  assert.strictEqual(parseDateTime(123), null);
  assert.strictEqual(parseDateTime("yesterday"), null);
});

test("pagination is opt-in and capped", () => {
  assert.strictEqual(getPagination({}), null);
  assert.deepStrictEqual(getPagination({ page: "3", limit: "10" }), { page: 3, limit: 10, offset: 20 });
  assert.deepStrictEqual(getPagination({ limit: "9999" }), { page: 1, limit: 100, offset: 0 });
  assert.deepStrictEqual(getPagination({ page: "-4", limit: "abc" }), { page: 1, limit: 20, offset: 0 });
  assert.deepStrictEqual(buildMeta({ page: 1, limit: 20 }, 45), { page: 1, limit: 20, total: 45, totalPages: 3 });
});

test("sorting only accepts whitelisted fields", () => {
  const allowed = { name: "ownerName" };
  assert.deepStrictEqual(getSort({ sort: "name", order: "asc" }, allowed, [["createdAt", "DESC"]]), [["ownerName", "ASC"], ["id", "ASC"]]);
  assert.deepStrictEqual(getSort({ sort: "name", order: "DESC" }, allowed, [["createdAt", "DESC"]]), [["ownerName", "DESC"], ["id", "DESC"]]);
  // unknown / dangerous values fall back to the default order
  assert.deepStrictEqual(getSort({ sort: "password_hash" }, allowed, [["createdAt", "DESC"]]), [["createdAt", "DESC"], ["id", "DESC"]]);
  assert.deepStrictEqual(getSort({ sort: "__proto__" }, allowed, [["createdAt", "DESC"]]), [["createdAt", "DESC"], ["id", "DESC"]]);
  assert.deepStrictEqual(getSort({ sort: ["name"] }, allowed, [["createdAt", "DESC"]]), [["createdAt", "DESC"], ["id", "DESC"]]);
});
