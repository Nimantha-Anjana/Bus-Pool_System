const app = require("./src/app");
const environment = require("./src/config/environment");
const { connectDatabase } = require("./src/config/database");


require("./src/models");


// Delete refresh tokens that expired or were revoked more than a day ago (the table only ever grows otherwise)
const purgeOldRefreshTokens = async () => {
  try {
    const { Op } = require("sequelize");
    const { RefreshToken } = require("./src/models");
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const removed = await RefreshToken.destroy({
      where: { [Op.or]: [{ expiresAt: { [Op.lt]: cutoff } }, { revokedAt: { [Op.lt]: cutoff } }] },
    });

    if (removed) console.log(`Purged ${removed} old refresh token(s).`);
  } catch (error) {
    console.error("Refresh token cleanup failed:", error.message);
  }
};

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

    // Clean once at start-up, then every 6 hours (unref: never keeps the process alive)
    purgeOldRefreshTokens();
    setInterval(purgeOldRefreshTokens, 6 * 60 * 60 * 1000).unref();

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
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

startServer();