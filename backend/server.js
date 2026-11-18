const app = require("./src/app");
const environment = require("./src/config/environment");
const { connectDatabase } = require("./src/config/database");
const { startJobs } = require("./src/services/jobs.service");
const { reportError } = require("./src/utils/error-reporter");


require("./src/models");


const startServer = async () => {
  try {
    // Connect to MySQL before starting the API
    await connectDatabase();

    const server = app.listen(environment.port, () => {
      console.log("----------------------------------------");
      console.log(" BUS POOL MANAGEMENT SYSTEM");
      console.log("----------------------------------------");
      console.log(`Server: http://localhost:${environment.port}`);
      console.log(`Health: http://localhost:${environment.port}/api/health`);
      console.log(`Environment: ${environment.nodeEnv}`);
      console.log("----------------------------------------");
    });

    // Reminders, e-mail retry, expired-link alerts and clean-up
    startJobs();

    const shutdown = (signal) => {
      console.log(`${signal} received. Shutting down server...`);

      // Do not hang forever if a connection refuses to close
      setTimeout(() => process.exit(1), 10000).unref();

      server.close(async () => {
        try {
          const { sequelize } = require("./src/config/database");
          await sequelize.close();

          console.log("Database connection closed.");
          process.exit(0);
        } catch (error) {
          console.error("Shutdown error:", error.message);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Unable to start application:", error.message);
    process.exit(1);
  }
};

// Log (instead of silently dying on) errors nobody caught
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  reportError(reason, "unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  reportError(error, "uncaughtException");
  // give the webhook a moment to leave before the process exits
  setTimeout(() => process.exit(1), 500);
});

startServer();