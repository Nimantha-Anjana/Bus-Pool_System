// Runs every tests/unit/*.test.js with the built-in node:test runner (works on any Node 18+ and on Windows).
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = path.join(__dirname, "unit");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => path.join(dir, f));

const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
