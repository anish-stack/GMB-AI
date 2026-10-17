/**
 * PM2 process file - HBS Suite (see VPS.md)
 *
 *   pm2 start ecosystem.config.cjs      first start
 *   pm2 reload ecosystem.config.cjs     after a redeploy (zero-downtime for the web app)
 *
 * IMPORTANT: hbs-scheduler and hbs-mail must always run as ONE instance each
 * (otherwise crons fire twice). Only hbs-web may be scaled.
 */
const path = require("node:path");
const cwd = __dirname;

module.exports = {
  apps: [
    {
      name: "hbs-web",
      cwd,
      script: path.join(cwd, "node_modules/next/dist/bin/next"),
      args: "start -p 3258 -H 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "2G",
      env: { NODE_ENV: "production", TZ: "Asia/Kolkata" },
      out_file: "/var/log/hbs-suite/web.out.log",
      error_file: "/var/log/hbs-suite/web.err.log",
      time: true,
    },
    {
      name: "hbs-scheduler",
      cwd,
      script: path.join(cwd, "scripts/scheduler.js"),
      node_args: "--conditions=react-server",
      args: "--no-mail",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "1G",
      restart_delay: 5000,
      env: { NODE_ENV: "production", TZ: "Asia/Kolkata" },
      out_file: "/var/log/hbs-suite/scheduler.out.log",
      error_file: "/var/log/hbs-suite/scheduler.err.log",
      time: true,
    },
    {
      name: "hbs-mail",
      cwd,
      script: path.join(cwd, "scripts/mailWorker.js"),
      node_args: "--conditions=react-server",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      restart_delay: 5000,
      env: { NODE_ENV: "production", TZ: "Asia/Kolkata" },
      out_file: "/var/log/hbs-suite/mail.out.log",
      error_file: "/var/log/hbs-suite/mail.err.log",
      time: true,
    },
  ],
};
