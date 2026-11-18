// Quick deployment test against a running API (production or staging). Changes nothing.
//   node scripts/smoke-test.js https://api.example.lk https://app.example.lk
// args: <api base url> [allowed frontend origin]
const base = (process.argv[2] || process.env.SMOKE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const origin = process.argv[3] || process.env.FRONTEND_URL;
const isHttps = base.startsWith("https://");

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` ${extra}`}`);
};

const call = (path, options = {}) => fetch(`${base}${path}`, { redirect: "manual", ...options });

(async () => {
  console.log(`Smoke test: ${base}\n`);

  const health = await call("/api/health");
  const body = await health.json().catch(() => ({}));
  check("health endpoint is up and the database is connected", health.status === 200 && body.data?.database === "connected", `status ${health.status}`);
  check("environment is production", body.data?.environment === "production", `got ${body.data?.environment}`);

  check("X-Powered-By is hidden", !health.headers.get("x-powered-by"));
  check("security headers (helmet) present", !!health.headers.get("x-content-type-options") && !!health.headers.get("content-security-policy"));
  if (isHttps) check("HSTS header present over HTTPS", !!health.headers.get("strict-transport-security"));
  else console.log("SKIP  HSTS (API url is not https)");

  check("admin API needs a token (401)", (await call("/api/admin/dashboard")).status === 401);
  check("driver API needs a token (401)", (await call("/api/driver/dashboard")).status === 401);
  check("bad token is rejected (401)", (await call("/api/admin/dashboard", { headers: { Authorization: "Bearer abc.def.ghi" } })).status === 401);
  check("unknown route gives 404 JSON", (await call("/api/nope")).status === 404);
  check("swagger docs are not public in production", (await call("/api/docs")).status === 404);

  const bad = await call("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  check("malformed JSON gives 400 (not 500)", bad.status === 400);

  if (origin) {
    const allowed = await call("/api/health", { headers: { Origin: origin } });
    check(`CORS allows ${origin}`, allowed.headers.get("access-control-allow-origin") === origin && allowed.headers.get("access-control-allow-credentials") === "true");
    const evil = await call("/api/health", { headers: { Origin: "https://evil.example" } });
    check("CORS does not allow other origins", !evil.headers.get("access-control-allow-origin"));
  } else console.log("SKIP  CORS (pass the frontend origin as 2nd argument)");

  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error("Smoke test could not run:", error.message);
  process.exit(1);
});
