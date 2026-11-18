// pm2 process file:  pm2 start ecosystem.config.js --env production && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "bus-pool-api",
      script: "server.js",
      instances: 1, // keep 1: the background jobs and the login throttle live in the process memory
      exec_mode: "fork",
      max_memory_restart: "400M",
      time: true, // timestamps in the log files
      env: { NODE_ENV: "development" },
      env_production: { NODE_ENV: "production" },
    },
  ],
};
