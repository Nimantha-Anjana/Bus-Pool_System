// Runs every file in backend/migrations once, in name order, and records it in `schema_migrations`.
// Safe to re-run. Each migration is also written to be idempotent on its own.
//
//   npm run db:migrate            apply pending migrations
//   npm run db:migrate -- --status   list applied / pending
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { sequelize } = require("../src/config/database");

const DIR = path.join(__dirname, "..", "migrations");

(async () => {
  try {
    await sequelize.authenticate();

    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name VARCHAR(150) NOT NULL PRIMARY KEY,
         applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    const [rows] = await sequelize.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name));

    const files = fs.readdirSync(DIR).filter((f) => /^\d+_.*\.js$/.test(f)).sort();

    if (process.argv.includes("--status")) {
      files.forEach((file) => console.log(`${applied.has(path.basename(file, ".js")) ? "applied" : "PENDING"}  ${file}`));
      process.exit(0);
    }

    let ran = 0;
    for (const file of files) {
      const migration = require(path.join(DIR, file));
      if (applied.has(migration.name)) continue;

      console.log(`Applying ${migration.name} ...`);
      await migration.up(sequelize);
      await sequelize.query("INSERT INTO schema_migrations (name) VALUES (?)", { replacements: [migration.name] });
      ran += 1;
    }

    console.log(ran ? `Done: ${ran} migration(s) applied.` : "Database is already up to date.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
})();
