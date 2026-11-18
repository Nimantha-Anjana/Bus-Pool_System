// Reports data-consistency problems. With --fix it repairs the bus status cache.
//   npm run db:check            report only
//   npm run db:check -- --fix   also reconcile buses.status with the assignments
require("dotenv").config();

const { sequelize } = require("../src/config/database");
const { findIntegrityProblems, reconcileBusStatuses } = require("../src/services/consistency.service");

(async () => {
  try {
    await sequelize.authenticate();

    if (process.argv.includes("--fix")) {
      console.log("Reconciled bus statuses:", await reconcileBusStatuses());
    }

    const problems = await findIntegrityProblems();
    let total = 0;

    for (const [name, rows] of Object.entries(problems)) {
      total += rows.length;
      console.log(`${rows.length ? "PROBLEM" : "ok     "}  ${name}${rows.length ? `: ${JSON.stringify(rows.slice(0, 10))}` : ""}`);
    }

    console.log(total ? `\n${total} problem(s) found.` : "\nNo integrity problems found.");
    process.exit(total ? 2 : 0);
  } catch (error) {
    console.error("Check failed:", error.message);
    process.exit(1);
  }
})();
