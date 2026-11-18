// Lets the unit tests load controllers / middleware WITHOUT a database or installed packages:
// `dotenv`, `sequelize` and `../models` are replaced by tiny stubs. Require this file first.
const Module = require("module");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DB_HOST ||= "localhost";
process.env.DB_NAME ||= "test";
process.env.DB_USER ||= "test";
process.env.JWT_ACCESS_SECRET ||= "a".repeat(40);
process.env.JWT_REFRESH_SECRET ||= "b".repeat(40);

const calls = { findAll: 0 };

const stubs = {
  dotenv: { config() {} },
  sequelize: { Op: new Proxy({}, { get: (_, key) => Symbol.for(String(key)) }) },
};

const modelsStub = {
  GpsLocation: { findOne: async () => null, bulkCreate: async () => [] },
  TourAssignment: { findAll: async () => { calls.findAll += 1; return []; }, findOne: async () => null },
  Tour: {}, Driver: {}, User: {}, Bus: {},
};

const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (stubs[request]) return stubs[request];
  if (request === "../models") return modelsStub;
  return original.apply(this, arguments);
};

const mockRes = () => ({
  code: 0,
  body: null,
  headers: {},
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
});

module.exports = { calls, mockRes, SRC: require("path").join(__dirname, "..", "..", "src") + "/" };
