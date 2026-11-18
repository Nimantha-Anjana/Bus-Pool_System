// Compressed MySQL/MariaDB backup using mysqldump (must be installed and on PATH).
//   npm run db:backup                -> backups/bus_pool_system-YYYYMMDD-HHMMSS.sql.gz
// Old backups are deleted after BACKUP_KEEP_DAYS (default 14). Uploaded files (uploads/, private_uploads/)
// are NOT in the SQL dump: copy those folders as well (see docs/DEPLOYMENT.md).
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawn } = require("child_process");

const dir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "..", "backups"));
const keepDays = Number(process.env.BACKUP_KEEP_DAYS) || 14;
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const file = path.join(dir, `${process.env.DB_NAME}-${stamp}.sql.gz`);

// The password goes through the environment, never on the command line (visible in `ps`)
const dump = spawn(
  "mysqldump",
  [
    "-h", process.env.DB_HOST, "-P", String(process.env.DB_PORT || 3306), "-u", process.env.DB_USER,
    "--single-transaction", "--routines", "--triggers", "--default-character-set=utf8mb4", process.env.DB_NAME,
  ],
  { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" }, stdio: ["ignore", "pipe", "inherit"] }
);

const out = fs.createWriteStream(file, { mode: 0o600 });
dump.stdout.pipe(zlib.createGzip()).pipe(out);

dump.on("error", (error) => {
  console.error(`Could not start mysqldump: ${error.message}`);
  fs.rmSync(file, { force: true });
  process.exit(1);
});

dump.on("close", (code) => {
  if (code !== 0) {
    console.error(`mysqldump failed (exit code ${code}).`);
    fs.rmSync(file, { force: true });
    process.exit(1);
  }

  out.on("finish", () => {
    console.log(`Backup written: ${file} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);

    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (name.endsWith(".sql.gz") && fs.statSync(full).mtimeMs < cutoff) {
        fs.rmSync(full);
        console.log(`Deleted old backup: ${name}`);
      }
    }
  });
});
