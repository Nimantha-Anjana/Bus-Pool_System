// Restore a backup made by backup-db.js. DESTRUCTIVE: it overwrites tables of the same name.
//   npm run db:restore -- backups/bus_pool_system-20261118-103000.sql.gz --yes
require("dotenv").config();

const fs = require("fs");
const zlib = require("zlib");
const { spawn } = require("child_process");

const file = process.argv[2];

if (!file || !fs.existsSync(file)) {
  console.error("Usage: npm run db:restore -- <backup.sql.gz> --yes");
  process.exit(1);
}

if (!process.argv.includes("--yes")) {
  console.error(`This will overwrite data in database "${process.env.DB_NAME}". Add --yes to continue.`);
  process.exit(1);
}

const mysql = spawn(
  "mysql",
  ["-h", process.env.DB_HOST, "-P", String(process.env.DB_PORT || 3306), "-u", process.env.DB_USER, "--default-character-set=utf8mb4", process.env.DB_NAME],
  { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" }, stdio: ["pipe", "inherit", "inherit"] }
);

mysql.on("error", (error) => {
  console.error(`Could not start mysql: ${error.message}`);
  process.exit(1);
});

mysql.on("close", (code) => {
  console.log(code === 0 ? "Restore finished." : `Restore failed (exit code ${code}).`);
  process.exit(code === 0 ? 0 : 1);
});

const input = file.endsWith(".gz") ? fs.createReadStream(file).pipe(zlib.createGunzip()) : fs.createReadStream(file);
input.on("error", (error) => {
  console.error(`Cannot read backup: ${error.message}`);
  mysql.kill();
  process.exit(1);
});
input.pipe(mysql.stdin);
