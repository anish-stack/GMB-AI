/**
 * Standalone mail worker (optional - the scheduler also sends mail).
 * Run: npm run mail-worker   (then start the scheduler with --no-mail)
 */
import "dotenv/config";

const INTERVAL = Number(process.env.MAIL_WORKER_INTERVAL_MS || 5000);
const { hydrateEnvFromIntegrations } = await import("../lib/integrations/store.js");
const { processEmailQueue } = await import("../lib/mail/queue.js");
await hydrateEnvFromIntegrations({ fresh: true }).catch(() => {});

let stop = false;
process.on("SIGINT", () => (stop = true));
process.on("SIGTERM", () => (stop = true));
console.log(`[mail-worker] started, polling every ${INTERVAL}ms`);
while (!stop) {
  try {
    const r = await processEmailQueue(25);
    if (r.sent || r.failed) console.log(`[mail-worker] sent ${r.sent}, failed ${r.failed}`);
  } catch (err) {
    console.error("[mail-worker]", err.message);
  }
  await new Promise((res) => setTimeout(res, INTERVAL));
}
process.exit(0);
