/**
 * Nightly scheduler (prototype). Run in a separate terminal:  npm run scheduler
 *
 * Two jobs:
 *   1. AI content job - generates every SCHEDULED calendar entry across ALL tenants.
 *      Suspended tenants, expired subscriptions and out-of-credit tenants are skipped
 *      by the orchestrator itself, so nothing is charged that should not be.
 *   2. Billing sweep - renews free plans, raises renewal invoices, moves unpaid
 *      subscriptions to PAST_DUE and then EXPIRED after the grace period.
 *
 * Production path: replace node-cron with BullMQ + Redis workers, one job per client.
 */
import "dotenv/config";
import cron from "node-cron";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const AI_EXPR = process.env.NIGHTLY_CRON || "0 0 * * *";
const BILLING_EXPR = process.env.BILLING_CRON || "30 1 * * *";
const IMAGE_CLEANUP_EXPR = process.env.IMAGE_CLEANUP_CRON || "0 2 * * *";
const MAIL_EXPR = process.env.MAIL_CRON || "*/2 * * * * *";
const KEY = process.env.SESSION_SECRET || "";

async function runAiJob() {
  console.log(`[scheduler] AI job start ${new Date().toISOString()}`);
  try {
    const res = await fetch(`${APP_URL}/api/ai/nightly`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scheduler-key": KEY },
      body: JSON.stringify({ source: "cron" }),
    });
    console.log("[scheduler] AI result:", JSON.stringify(await res.json()));
  } catch (err) {
    console.error("[scheduler] AI job failed:", err.message);
  }
}

/**
 * The billing sweep runs directly against the database - it needs no session,
 * and it must keep working even if the web app is momentarily down.
 */
async function runBilling() {
  console.log(`[scheduler] billing sweep start ${new Date().toISOString()}`);
  try {
    const { runBillingCycle } = await import("../lib/saas/billing.js");
    const result = await runBillingCycle();
    console.log("[scheduler] billing result:", JSON.stringify(result));
  } catch (err) {
    console.error("[scheduler] billing sweep failed:", err.message);
  }
}

/**
 * Deletes AI-generated/uploaded images older than IMAGE_RETENTION_DAYS (default
 * 90) from whichever storage provider holds them. Runs directly against the
 * database + storage, same as billing - no session needed.
 */
async function runImageCleanup() {
  console.log(`[scheduler] image cleanup start ${new Date().toISOString()}`);
  try {
    const { cleanupOldImages } = await import("../lib/images/cleanup.js");
    const result = await cleanupOldImages();
    console.log("[scheduler] image cleanup result:", JSON.stringify(result));
  } catch (err) {
    console.error("[scheduler] image cleanup failed:", err.message);
  }
}

/**
 * Background email worker. Every route in the app (signup, login OTP, payment,
 * post publish, GMB connect, nightly summary) only INSERTs a row into
 * email_queue and returns immediately - this is the worker that actually
 * talks to SMTP, on its own short cron, completely decoupled from user
 * requests. Runs every minute by default; safe to run more than once
 * concurrently (rows are claimed atomically in lib/mail/queue.js).
 */
let mailWorkerRunning = false;
async function runMailWorker() {
  const startedAt = new Date();

  console.log(
    `\n[scheduler][mail] ▶ START ${startedAt.toISOString()}`
  );

  // Prevent overlap if previous run takes > 2 seconds
  if (mailWorkerRunning) {
    console.log(
      `[scheduler][mail] ⏭ SKIPPED - previous worker is still running`
    );
    return;
  }

  mailWorkerRunning = true;

  try {
    console.log("[scheduler][mail] Loading email queue...");

    const { processEmailQueue } = await import("../lib/mail/queue.js");

    console.log("[scheduler][mail] Processing max 25 emails...");

    const result = await processEmailQueue(25);

    console.log(
      "[scheduler][mail] ✅ RESULT:",
      JSON.stringify(result, null, 2)
    );
  } catch (err) {
    console.error("[scheduler][mail] ❌ FAILED:", err);

    console.error(
      "[scheduler][mail] Error message:",
      err?.message || "Unknown error"
    );
  } finally {
    mailWorkerRunning = false;

    const finishedAt = new Date();
    const duration = finishedAt.getTime() - startedAt.getTime();

    console.log(
      `[scheduler][mail] ■ END ${finishedAt.toISOString()} (${duration}ms)\n`
    );
  }
}

cron.schedule(AI_EXPR, runAiJob);
cron.schedule(BILLING_EXPR, runBilling);
cron.schedule(IMAGE_CLEANUP_EXPR, runImageCleanup);
cron.schedule(MAIL_EXPR, runMailWorker);
console.log(`[scheduler] AI job "${AI_EXPR}" -> ${APP_URL}/api/ai/nightly`);
console.log(`[scheduler] billing sweep "${BILLING_EXPR}" -> direct database`);
console.log(`[scheduler] image cleanup "${IMAGE_CLEANUP_EXPR}" -> direct storage (retention: ${process.env.IMAGE_RETENTION_DAYS || 90} days)`);
console.log(`[scheduler] mail worker "${MAIL_EXPR}" -> direct database + SMTP (queue: email_queue)`);

if (process.argv.includes("--now")) runAiJob();
if (process.argv.includes("--billing")) runBilling();
if (process.argv.includes("--cleanup-images")) runImageCleanup();
if (process.argv.includes("--mail")) runMailWorker();
