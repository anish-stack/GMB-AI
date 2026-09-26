import { query, one, insert, update } from "../db.js";
import { sendMailNow } from "./transport.js";
import { beat } from "../system/heartbeat.js";

/**
 * Background email queue.
 *
 * WHY: API routes (signup, login, publish, GMB connect...) must respond fast.
 * Actually talking to an SMTP server can take a second or more and occasionally
 * times out - doing that inline would slow down (or break) the request that
 * triggered it. So every place in the app that needs to send an email just
 * calls queueEmail(), which is a single fast INSERT, and returns immediately.
 *
 * A separate worker (scripts/mailWorker.js, also wired into scripts/scheduler.js
 * on a short cron) drains this table and does the actual SMTP send. This is the
 * same "don't block the request, let a worker do it" pattern used for the
 * nightly AI job - see scripts/scheduler.js.
 *
 * In an environment with real Workers/queues (Cloudflare Queues, SQS, BullMQ +
 * Redis) you would swap processEmailQueue()'s caller for a queue consumer and
 * queueEmail()'s insert for `queue.send(...)` - the call sites in the app
 * (queueEmail everywhere) would not need to change.
 */

export async function queueEmail({ to, subject, html, text = null, template = "generic", tenantId = null, meta = null }) {
  if (!to) {
    console.warn(`[mail-queue] skipped "${subject}" - no recipient email on file`);
    return null;
  }
  try {
    return await insert("email_queue", {
      to_email: to,
      subject,
      html,
      text,
      template,
      tenant_id: tenantId,
      meta: meta ? JSON.stringify(meta) : null,
      status: "PENDING",
    });
  } catch (err) {
    // Queueing an email must never break the caller's main action (signup, publish, etc).
    console.error(`[mail-queue] failed to enqueue "${subject}" for ${to}:`, err.message);
    return null;
  }
}

const MAX_ATTEMPTS = 5;
// Exponential-ish backoff in minutes, indexed by attempt count
const BACKOFF_MINUTES = [1, 5, 15, 60, 180];

/**
 * Drains up to `batchSize` pending emails and actually sends them via SMTP.
 * Safe to call repeatedly/concurrently - each row is claimed with an UPDATE
 * before sending so two overlapping worker runs won't double-send.
 */
export async function processEmailQueue(batchSize = 20) {
  const rows = await query(
    `SELECT * FROM email_queue
      WHERE status='PENDING' AND available_at <= NOW()
      ORDER BY id ASC LIMIT ?`,
    [batchSize]
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    // Claim it first so a concurrent worker run skips it.
    const claimed = await query(
      "UPDATE email_queue SET status='SENDING' WHERE id=? AND status='PENDING'",
      [row.id]
    );
    if (!claimed || claimed.affectedRows !== 1) continue;

    try {
      // meta.attachment is how we carry a small file (e.g. a GMB CSV report) through
      // the queue without a schema change - stored as base64 text in the TEXT `meta` column.
      let attachments;
      if (row.meta) {
        try {
          const meta = JSON.parse(row.meta);
          if (meta?.attachment?.contentBase64) {
            attachments = [{
              filename: meta.attachment.filename || "attachment",
              content: meta.attachment.contentBase64,
              encoding: "base64",
              contentType: meta.attachment.contentType || "application/octet-stream",
            }];
          }
        } catch {
          // meta wasn't JSON / had no attachment - fine, just send without one
        }
      }
      await sendMailNow({ to: row.to_email, subject: row.subject, html: row.html, text: row.text, attachments });
      await update("email_queue", row.id, { status: "SENT", sent_at: new Date(), last_error: null });
      await afterSend(row, true);
      sent++;
    } catch (err) {
      const attempts = (row.attempts || 0) + 1;
      const givingUp = attempts >= (row.max_attempts || MAX_ATTEMPTS);
      const delayMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
      await update("email_queue", row.id, {
        status: givingUp ? "FAILED" : "PENDING",
        attempts,
        last_error: String(err.message || err).slice(0, 490),
        available_at: new Date(Date.now() + delayMin * 60000),
      });
      if (givingUp) await afterSend(row, false, err.message);
      failed++;
      console.error(`[mail-queue] send failed (attempt ${attempts}) for "${row.subject}" -> ${row.to_email}:`, err.message);
    }
  }

  await beat("mail_worker", { ok: failed === 0 || sent > 0, message: `checked ${rows.length}, sent ${sent}, failed ${failed}` });
  return { checked: rows.length, sent, failed };
}

/** Delivery callbacks (e.g. report share history). */
async function afterSend(row, ok, error = null) {
  try {
    const meta = row.meta ? JSON.parse(row.meta) : null;
    if (meta?.reportShareId) {
      const { markShareDelivery } = await import("../reports/share.js");
      await markShareDelivery(meta.reportShareId, ok, error);
    }
  } catch {
    /* meta not JSON */
  }
}

export async function queueStats() {
  const rows = await query(
    "SELECT status, COUNT(*) AS n FROM email_queue GROUP BY status"
  );
  return rows.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.n) }), { PENDING: 0, SENT: 0, FAILED: 0, SENDING: 0 });
}

export async function retryFailedEmail(id) {
  return update("email_queue", id, { status: "PENDING", available_at: new Date(), last_error: null });
}
