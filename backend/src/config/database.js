const { Sequelize } = require("sequelize");
const environment = require("./environment");

const sequelize = new Sequelize(
  environment.database.name,
  environment.database.username,
  environment.database.password,
  {
    host: environment.database.host,
    port: environment.database.port,
    dialect: "mysql",

    logging:
      environment.nodeEnv === "development"
        ? console.log
        : false,

    timezone: "+00:00",

    dialectOptions: {
      charset: "utf8mb4",
    },

    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },

    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
  }
);

const connectDatabase = async () => {
  try {
    await sequelize.authenticate();

    console.log("MySQL database connection established successfully.");
  } catch (error) {
    console.error("MySQL database connection failed:", error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectDatabase,
};