const test = require("node:test");
const assert = require("node:assert");
const { calls, mockRes, SRC } = require("../helpers/setup");
const { saveLocation } = require(SRC + "controllers/gps.controller");

const send = async (body) => {
  const res = mockRes();
  await saveLocation({ body, user: { driverId: 1 } }, res, (error) => { throw error; });
  return res;
};

test("invalid GPS points are rejected before the database is touched", async () => {
  const before = calls.findAll;
  const bad = [
    { latitude: null, longitude: 80 },        // used to be saved as 0
    { latitude: "", longitude: 80 },
    { latitude: true, longitude: 80 },
    { latitude: 7, longitude: undefined },
    { latitude: 91, longitude: 80 },
    { latitude: 7, longitude: 181 },
    { latitude: 7, longitude: 80, speed: true },
    { latitude: 7, longitude: 80, speed: -1 },
    { latitude: 7, longitude: 80, recordedAt: "not a date" },
    { points: [] },
  ];
  for (const body of bad) assert.strictEqual((await send(body)).code, 400, JSON.stringify(body));
  assert.strictEqual(calls.findAll, before);
});

test("a valid point reaches the assignment lookup", async () => {
  const res = await send({ latitude: "7.2906", longitude: 80.6337 });
  assert.strictEqual(res.code, 409); // the stub has no ongoing tour
});
