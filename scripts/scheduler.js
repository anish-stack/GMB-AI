/**
 * Nightly scheduler (prototype). Runs in a separate terminal:  npm run scheduler
 * It calls the app's API route, so the same code path as the admin
 * "Run AI Nightly Job Now" button is used.
 *
 * Production path: replace node-cron with BullMQ + Redis workers.
 * The queue payload would be { type: "NIGHTLY", date } and each client
 * would be a separate job for retries and concurrency control.
 */
import "dotenv/config";
import cron from "node-cron";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const EXPR = process.env.NIGHTLY_CRON || "0 0 * * *";

async function run() {
  const started = new Date();
  console.log(`[scheduler] nightly job start ${started.toISOString()}`);
  try {
    const res = await fetch(`${APP_URL}/api/ai/nightly`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scheduler-key": process.env.SESSION_SECRET || "" },
      body: JSON.stringify({ source: "cron" }),
    });
    const data = await res.json();
    console.log("[scheduler] result:", JSON.stringify(data));
  } catch (err) {
    console.error("[scheduler] failed:", err.message);
  }
}

cron.schedule(EXPR, run);
console.log(`[scheduler] armed with "${EXPR}" -> ${APP_URL}/api/ai/nightly`);
if (process.argv.includes("--now")) run();
