const app = require("./src/app");
const environment = require("./src/config/environment");
const { connectDatabase } = require("./src/config/database");


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

    const shutdown = (signal) => {
      console.log(`${signal} received. Shutting down server...`);

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

startServer();