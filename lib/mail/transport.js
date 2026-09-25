import nodemailer from "nodemailer";

/**
 * Single shared nodemailer transporter, built from SMTP_* env vars.
 * Works with any SMTP provider (Gmail app password, SendGrid, Mailgun, SES SMTP,
 * Brevo, Resend SMTP, etc.) - just point the env vars at it.
 *
 * If SMTP is not configured (local/dev), we fall back to nodemailer's JSON
 * transport so the app keeps working and queued emails are logged instead of
 * thrown away - nothing crashes just because .env is empty.
 */
const globalForMail = globalThis;

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "[mail] SMTP_HOST/SMTP_USER/SMTP_PASS not set - emails will be logged to the console only (dev mode)."
    );
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")) === "true",
    auth: { user, pass },
    pool: true, // reuse connections - the worker can send a batch without reconnecting each time
    maxConnections: 3,
    maxMessages: 50,
  });
}

export const transporter = globalForMail.__gmbMailTransport || buildTransport();
if (!globalForMail.__gmbMailTransport) globalForMail.__gmbMailTransport = transporter;

export function mailFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "GMB AI Cloud <no-reply@example.com>";
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Low-level send - used only by the queue worker, never directly from an API route.
 * attachments: [{ filename, content (base64 string), encoding: "base64", contentType }] */
export async function sendMailNow({ to, subject, html, text, attachments }) {
  if (!to) throw new Error("sendMailNow: 'to' is required");
  return transporter.sendMail({
    from: mailFrom(),
    to,
    subject,
    html,
    text: text || undefined,
    ...(attachments?.length ? { attachments } : {}),
  });
}
