/**
 * Background scheduler - run in its own process:  npm run scheduler
 *
 *   AI job          NIGHTLY_CRON (00:00)   -> POST /api/ai/nightly (generates SCHEDULED calendar slots;
 *                                            posting-plan caps, expiry and maintenance are enforced there)
 *   Billing sweep   BILLING_CRON (01:30)   -> renewals, past-due, expiry
 *   Housekeeping    HOUSEKEEPING_CRON (02:30) -> expire posting plans, prune rate-limit counters
 *   Image cleanup   IMAGE_CLEANUP_CRON (02:00)
 *   Mail worker     MAIL_CRON (every 10s)  -> sends queued emails (or run `npm run mail-worker` separately)
 *   Health check    HEALTH_CRON (hourly)   -> stores a run in health_check_runs
 *   Review sync     REVIEW_SYNC_CRON (every 30 min) -> review inbox fallback when Pub/Sub is off
 *   Listing health  LISTING_HEALTH_CRON (03:00)     -> suspension / access / duplicate monitor
 *   Heartbeat       every minute           -> shows up in Admin -> System health
 *
 * Started with `node --conditions=react-server` (see package.json) so lib modules
 * that import "server-only" can be loaded outside Next.js.
 */
import "dotenv/config";
import cron from "node-cron";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.SESSION_SECRET || "";
const EXPR = {
  ai: process.env.NIGHTLY_CRON || "0 0 * * *",
  billing: process.env.BILLING_CRON || "30 1 * * *",
  images: process.env.IMAGE_CLEANUP_CRON || "0 2 * * *",
  housekeeping: process.env.HOUSEKEEPING_CRON || "30 2 * * *",
  mail: process.env.MAIL_CRON || "*/10 * * * * *",
  health: process.env.HEALTH_CRON || "5 * * * *",
  reviews: process.env.REVIEW_SYNC_CRON || "*/30 * * * *",
  listings: process.env.LISTING_HEALTH_CRON || "0 3 * * *",
};
const log = (...a) => console.log(`[scheduler ${new Date().toISOString()}]`, ...a);

async function hydrate() {
  const { hydrateEnvFromIntegrations } = await import("../lib/integrations/store.js");
  await hydrateEnvFromIntegrations({ fresh: true });
}

async function beat(name, ok = true, message = null) {
  const { beat: b } = await import("../lib/system/heartbeat.js");
  await b(name, { ok, message });
}

async function runAiJob() {
  log("AI job start");
  try {
    const res = await fetch(`${APP_URL}/api/ai/nightly`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scheduler-key": KEY },
      body: JSON.stringify({ source: "cron" }),
    });
    const data = await res.json().catch(() => ({}));
    log("AI job done", res.status, data.skipped ? `skipped (${data.skipped})` : `${data.generated ?? 0}/${data.scheduled ?? 0} generated`);
  } catch (err) {
    await beat("nightly_job", false, err.message);
    log("AI job failed:", err.message);
  }
}

async function runBilling() {
  try {
    const { runBillingCycle } = await import("../lib/saas/billing.js");
    const r = await runBillingCycle();
    await beat("billing", true, JSON.stringify(r).slice(0, 400));
    log("billing sweep", JSON.stringify(r));
  } catch (err) {
    await beat("billing", false, err.message);
    log("billing failed:", err.message);
  }
}

async function runImageCleanup() {
  try {
    const { cleanupOldImages } = await import("../lib/images/cleanup.js");
    log("image cleanup", JSON.stringify(await cleanupOldImages()));
  } catch (err) {
    log("image cleanup failed:", err.message);
  }
}

async function runHousekeeping() {
  try {
    const { expirePlans } = await import("../lib/posting/plan.js");
    const { pruneCounters } = await import("../lib/api/rateLimiter.js");
    const expired = await expirePlans();
    await pruneCounters();
    log(`housekeeping: ${expired} plan(s) expired, rate counters pruned`);
  } catch (err) {
    log("housekeeping failed:", err.message);
  }
}

let mailBusy = false;
async function runMailWorker() {
  if (mailBusy) return;
  mailBusy = true;
  try {
    const { processEmailQueue } = await import("../lib/mail/queue.js");
    const r = await processEmailQueue(25);
    if (r.sent || r.failed) log(`mail: sent ${r.sent}, failed ${r.failed}`);
  } catch (err) {
    log("mail worker failed:", err.message);
  } finally {
    mailBusy = false;
  }
}

let reviewBusy = false;
async function runReviewSync() {
  if (reviewBusy) return;
  reviewBusy = true;
  try {
    const { syncReviews } = await import("../lib/reviews/inbox.js");
    const r = await syncReviews();
    await beat("review_sync", true, `${r.clients} listings, ${r.fresh} new, ${r.errors} errors`);
    if (r.fresh) log(`review sync: ${r.fresh} new review(s)`);
  } catch (err) {
    await beat("review_sync", false, err.message);
    log("review sync failed:", err.message);
  } finally {
    reviewBusy = false;
  }
}

async function runListingHealth() {
  try {
    const { checkAllListings } = await import("../lib/gmb/healthMonitor.js");
    const r = await checkAllListings();
    await beat("listing_monitor", true, JSON.stringify(r));
    log("listing health", JSON.stringify(r));
  } catch (err) {
    await beat("listing_monitor", false, err.message);
    log("listing health failed:", err.message);
  }
}

async function runHealth() {
  try {
    const { runHealthChecks } = await import("../lib/system/health.js");
    const r = await runHealthChecks({ runBy: "scheduler" });
    if (r.overall !== "HEALTHY") log(`health ${r.overall}:`, r.results.filter((x) => x.status === "FAILED").map((x) => x.name).join(", "));
  } catch (err) {
    log("health check failed:", err.message);
  }
}

await hydrate().catch((e) => log("integration settings not loaded:", e.message));
cron.schedule(EXPR.ai, runAiJob);
cron.schedule(EXPR.billing, runBilling);
cron.schedule(EXPR.images, runImageCleanup);
cron.schedule(EXPR.housekeeping, runHousekeeping);
cron.schedule(EXPR.health, runHealth);
cron.schedule(EXPR.reviews, runReviewSync);
cron.schedule(EXPR.listings, runListingHealth);
if (!process.argv.includes("--no-mail")) cron.schedule(EXPR.mail, runMailWorker);
cron.schedule("* * * * *", () => beat("scheduler").catch(() => {}));
cron.schedule("*/5 * * * *", () => hydrate().catch(() => {}));
beat("scheduler").catch(() => {});
log("started", JSON.stringify(EXPR), `-> ${APP_URL}`);

if (process.argv.includes("--now")) runAiJob();
if (process.argv.includes("--billing")) runBilling();
if (process.argv.includes("--cleanup-images")) runImageCleanup();
if (process.argv.includes("--housekeeping")) runHousekeeping();
if (process.argv.includes("--mail")) runMailWorker();
if (process.argv.includes("--reviews")) runReviewSync();
if (process.argv.includes("--listings")) runListingHealth();
