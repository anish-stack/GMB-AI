import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query, one, insert, update } from "../db.js";
import { hmac, randomToken } from "../security/crypto.js";
import { buildGmbReport, reportFilename, reportToCsv } from "./gmbReport.js";
import { renderGmbReportPdf } from "./pdf.js";
import { queueEmail } from "../mail/queue.js";
import { gmbReportEmail } from "../mail/templates.js";

const DIR = process.env.REPORT_STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "reports");
const LINK_DAYS = Number(process.env.REPORT_LINK_DAYS || 30);
export const SHARE_METHODS = ["DOWNLOAD", "EMAIL", "LINK", "WHATSAPP"];

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

async function storePdf(buf) {
  await fs.mkdir(DIR, { recursive: true });
  const key = `${new Date().toISOString().slice(0, 7)}-${crypto.randomUUID()}.pdf`;
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ DIR, key), buf);
  return key;
}

export async function readStoredPdf(key) {
  const safe = path.basename(String(key || ""));
  if (!/^[\w-]+\.pdf$/.test(safe)) throw Object.assign(new Error("File not found"), { status: 404 });
  return fs.readFile(path.join(/*turbopackIgnore: true*/ DIR, safe));
}

/**
 * Generates the PDF, stores it, and records a share-history row.
 * method: DOWNLOAD (just generated), EMAIL (queued with attachment + link),
 *         LINK / WHATSAPP (private view link returned to the caller).
 */
export async function createReportShare({ clientId, tenantId, days = 30, method = "DOWNLOAD", to = null, name = null, phone = null, actor }) {
  const m = SHARE_METHODS.includes(method) ? method : "DOWNLOAD";
  const report = await buildGmbReport(clientId, days);
  if (report.client.tenant_id !== tenantId) throw Object.assign(new Error("Client not found"), { status: 404 });
  const pdf = await renderGmbReportPdf(report);
  const key = await storePdf(pdf);

  const token = m === "DOWNLOAD" ? null : randomToken(24);
  const email = to ? String(to).trim().toLowerCase().slice(0, 190) : null;
  if (m === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) throw Object.assign(new Error("A valid recipient email is required."), { status: 400 });
  const phoneClean = phone ? String(phone).replace(/[^\d+]/g, "").slice(0, 20) : null;
  if (m === "WHATSAPP" && (!phoneClean || phoneClean.replace(/\D/g, "").length < 10)) throw Object.assign(new Error("A valid WhatsApp number is required."), { status: 400 });

  const id = await insert("report_shares", {
    tenant_id: tenantId,
    client_id: clientId,
    location_name: report.profile?.business_name || report.client.business_name,
    report_type: "GMB_PERFORMANCE",
    period_start: report.period.start,
    period_end: report.period.end,
    file_key: key,
    file_size: pdf.length,
    view_token_hash: token ? hmac(token) : null,
    shared_by_user_id: actor?.userId || null,
    shared_by_name: actor?.name || "system",
    shared_with_name: name ? String(name).slice(0, 160) : null,
    shared_with_email: email,
    shared_with_phone: phoneClean,
    method: m,
    status: m === "DOWNLOAD" ? "GENERATED" : m === "EMAIL" ? "QUEUED" : "SENT",
    expires_at: token ? new Date(Date.now() + LINK_DAYS * 86400000) : null,
  });

  const link = token ? `${appUrl()}/r/${token}` : null;
  if (m === "EMAIL") {
    try {
      const tpl = gmbReportEmail({ businessName: report.client.business_name, days: report.period.days, totals: report.totals, source: report.source, appUrl: appUrl(), reportUrl: link });
      await queueEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        template: "gmb_report",
        tenantId,
        meta: { reportShareId: id, attachment: { filename: reportFilename(report, "pdf"), contentType: "application/pdf", contentBase64: pdf.toString("base64") } },
      });
    } catch (err) {
      await update("report_shares", id, { status: "FAILED", error: String(err.message).slice(0, 480) });
      throw err;
    }
  }
  const whatsapp = m === "WHATSAPP"
    ? `https://wa.me/${phoneClean.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi${name ? ` ${name}` : ""}, here is the Google Business Profile report for ${report.client.business_name} (${report.period.start} to ${report.period.end}): ${link}`)}`
    : null;
  return { id, pdf, filename: reportFilename(report, "pdf"), link, whatsapp, report };
}

export function csvFor(report) {
  return reportToCsv(report);
}

/** Public, token-based view (recipient opens the link) - counts views. */
export async function openSharedReport(token) {
  if (!/^[\w-]{20,64}$/.test(String(token || ""))) return null;
  const row = await one("SELECT * FROM report_shares WHERE view_token_hash=?", [hmac(token)]);
  if (!row || (row.expires_at && new Date(row.expires_at) < new Date())) return null;
  await query(
    "UPDATE report_shares SET view_count=view_count+1, first_viewed_at=COALESCE(first_viewed_at, NOW()), last_viewed_at=NOW() WHERE id=?",
    [row.id],
  );
  return { row, pdf: await readStoredPdf(row.file_key) };
}

export async function listShares(tenantId, { clientId = null, method = null, q = null, limit = 50, offset = 0 } = {}) {
  const where = ["s.tenant_id=?"];
  const params = [tenantId];
  if (clientId) { where.push("s.client_id=?"); params.push(Number(clientId)); }
  if (method && SHARE_METHODS.includes(method)) { where.push("s.method=?"); params.push(method); }
  if (q) { where.push("(c.business_name LIKE ? OR s.shared_with_email LIKE ? OR s.shared_with_name LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await query(
    `SELECT s.id, s.client_id, c.business_name, s.location_name, s.report_type, s.period_start, s.period_end, s.file_size,
            s.shared_by_name, s.shared_with_name, s.shared_with_email, s.shared_with_phone, s.method, s.status, s.error,
            s.view_count, s.first_viewed_at, s.last_viewed_at, s.expires_at, s.created_at
       FROM report_shares s JOIN clients c ON c.id=s.client_id
      WHERE ${where.join(" AND ")} ORDER BY s.id DESC LIMIT ${Math.min(Number(limit) || 50, 200)} OFFSET ${Number(offset) || 0}`,
    params,
  );
  const [{ total }] = await query(`SELECT COUNT(*) total FROM report_shares s JOIN clients c ON c.id=s.client_id WHERE ${where.join(" AND ")}`, params);
  return { items: rows, total: Number(total) };
}

/** Mail queue callback: mark the share SENT / FAILED once SMTP answers. */
export async function markShareDelivery(shareId, ok, error = null) {
  await query("UPDATE report_shares SET status=?, error=? WHERE id=?", [ok ? "SENT" : "FAILED", error ? String(error).slice(0, 480) : null, shareId]);
}
