const test = require("node:test");
const assert = require("node:assert");
const { SRC } = require("../helpers/setup");

const load = (env) => {
  const keys = Object.keys(env);
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  delete require.cache[require.resolve(SRC + "config/environment")];
  try {
    return require(SRC + "config/environment");
  } finally {
    keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
    delete require.cache[require.resolve(SRC + "config/environment")];
  }
};

test("FRONTEND_URL can hold several origins", () => {
  const env = load({ NODE_ENV: "test", FRONTEND_URL: "https://a.lk/, https://www.a.lk" });
  assert.deepStrictEqual(env.frontendUrls, ["https://a.lk", "https://www.a.lk"]);
});

test("production refuses unsafe settings", () => {
  assert.throws(
    () => load({ NODE_ENV: "production", FRONTEND_URL: "http://localhost:5173", API_PUBLIC_URL: "http://x", DB_PASSWORD: "", SMTP_HOST: "" }),
    /Unsafe production configuration/
  );
});

test("production accepts a safe configuration", () => {
  const env = load({
    NODE_ENV: "production",
    FRONTEND_URL: "https://buspool.lk",
    API_PUBLIC_URL: "https://api.buspool.lk",
    DB_PASSWORD: "x9Qv-long-db-pass",
    SMTP_HOST: "smtp.example.lk",
    JWT_ACCESS_SECRET: "k3Jd8sLq0Zp1Wm7Rt2Yv9Xb4Nc6Hf5Ga8Ue1Oi3",
    JWT_REFRESH_SECRET: "P0o9I8u7Y6t5R4e3W2q1A2s3D4f5G6h7J8k9L0z1",
  });
  assert.strictEqual(env.nodeEnv, "production");
  assert.strictEqual(env.enableApiDocs, false);
});
