// Writes docs/openapi.json and docs/API_ENDPOINTS.md from src/docs/openapi.js
//   npm run docs:generate
const fs = require("fs");
const path = require("path");
const spec = require("../src/docs/openapi");

const out = path.join(__dirname, "..", "docs");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "openapi.json"), JSON.stringify(spec, null, 2) + "\n");

const lines = ["# API endpoints", "", "Generated from `src/docs/openapi.js` (`npm run docs:generate`). Live docs: `GET /api/docs`.", ""];
const byTag = {};

for (const [route, operations] of Object.entries(spec.paths))
  for (const [method, op] of Object.entries(operations)) {
    const secured = op.security === undefined || op.security.length > 0;
    const role = route.startsWith("/api/admin") ? "Admin" : route.startsWith("/api/driver") ? "Driver" : secured ? "Any logged-in user" : "Public";
    (byTag[op.tags[0]] ||= []).push(`| ${method.toUpperCase()} | \`${route}\` | ${role} | ${op.summary} |`);
  }

for (const [tag, rows] of Object.entries(byTag)) {
  lines.push(`## ${tag}`, "", "| Method | Path | Who | Description |", "|---|---|---|---|", ...rows, "");
}

fs.writeFileSync(path.join(out, "API_ENDPOINTS.md"), lines.join("\n"));
console.log("Written docs/openapi.json and docs/API_ENDPOINTS.md");
