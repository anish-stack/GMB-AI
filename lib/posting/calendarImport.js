import ExcelJS from "exceljs";
import { query, one, insert } from "../db.js";
import { assertCanSchedule, withPlanLock } from "./plan.js";
import { POST_TYPES } from "../constants.js";

export const CTAS = ["None", "Book", "Order online", "Buy", "Learn more", "Sign up", "Call now"];
export const COLUMNS = ["client", "date", "time", "post_type", "topic", "primary_keyword", "secondary_keywords", "tertiary_keywords", "button"];

/** Optional per-post keywords, time and button. */
export function calendarExtras(b) {
  const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,;|]/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 3).join(", ") || null;
  const t = String(b.scheduled_time ?? b.time ?? "").trim();
  return {
    scheduled_time: /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5).padStart(5, "0") : null,
    primary_keyword: b.primary_keyword ? String(b.primary_keyword).trim().slice(0, 180) : null,
    secondary_keywords: list(b.secondary_keywords),
    tertiary_keywords: list(b.tertiary_keywords),
    cta: CTAS.find((c) => c.toLowerCase() === String(b.cta ?? b.button ?? "").trim().toLowerCase()) || null,
  };
}

/** Template with headers + 2 examples. */
export async function templateXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Posts");
  ws.columns = COLUMNS.map((k) => ({ header: k, key: k, width: k.includes("keyword") || k === "topic" ? 34 : 16 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow({ client: "ABC Dental Clinic (or client id)", date: "2026-10-05", time: "10:30", post_type: "Service", topic: "Painless root canal", primary_keyword: "root canal treatment rohini", secondary_keywords: "dentist rohini, tooth pain relief", tertiary_keywords: "root canal near rohini west metro", button: "Book" });
  ws.addRow({ client: "", date: "2026-10-08", time: "18:00", post_type: "Offer", topic: "", primary_keyword: "", secondary_keywords: "", tertiary_keywords: "", button: "Call now" });
  const note = wb.addWorksheet("Help");
  [
    ["client", "Client name or id. Leave empty when you pick the client in the import screen."],
    ["date", "YYYY-MM-DD (or an Excel date). Required."],
    ["time", "HH:MM 24h - when auto-publish posts it. Optional."],
    ["post_type", POST_TYPES.join(", ")],
    ["topic / keywords", "Optional - empty = AI agents choose. Keywords: up to 3, comma separated."],
    ["button", CTAS.join(", ")],
  ].forEach((r) => note.addRow(r));
  note.getColumn(1).width = 18;
  note.getColumn(2).width = 90;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const cellText = (v) => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return v.text ?? v.result ?? (v.richText ? v.richText.map((r) => r.text).join("") : "");
  return String(v);
};

function toDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = cellText(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000).toISOString().slice(0, 10);
  return null;
}

function toTime(v) {
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof v === "number" && v < 1) { const m = Math.round(v * 1440); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
  return cellText(v).trim();
}

/** Reads .xlsx or .csv into plain rows keyed by COLUMNS. */
export async function readSheet(buf, filename = "") {
  const rows = [];
  if (/\.csv$/i.test(filename)) {
    const lines = buf.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    const split = (l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    const head = split(lines.shift() || "").map((h) => h.toLowerCase());
    for (const l of lines) {
      const cells = split(l);
      rows.push(Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""])));
    }
    return rows;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return rows;
  const head = [];
  ws.getRow(1).eachCell((c, i) => (head[i] = cellText(c.value).trim().toLowerCase()));
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {};
    head.forEach((h, i) => { if (h) o[h] = row.getCell(i).value; });
    if (Object.values(o).some((v) => cellText(v).trim())) rows.push(o);
  });
  return rows;
}

/**
 * Validates every row; with commit=true inserts them all-or-nothing per client
 * (posting-plan caps are checked for all dates of a client together).
 */
export async function importCalendar({ tenantId, rows, defaultClientId = null, commit = false, employeeId = null }) {
  if (rows.length > 500) throw Object.assign(new Error("Max 500 rows per import."), { status: 400 });
  const clients = await query("SELECT id, business_name FROM clients WHERE tenant_id=? AND active=1", [tenantId]);
  const byId = new Map(clients.map((c) => [String(c.id), c]));
  const byName = new Map(clients.map((c) => [c.business_name.trim().toLowerCase(), c]));
  const out = [];
  rows.forEach((r, i) => {
    const errors = [];
    const ref = cellText(r.client).trim();
    const client = ref ? byId.get(ref) || byName.get(ref.toLowerCase()) : defaultClientId ? byId.get(String(defaultClientId)) : null;
    if (!client) errors.push(ref ? `Unknown client "${ref}"` : "Client missing");
    const date = toDate(r.date);
    if (!date) errors.push("Invalid date");
    const postType = cellText(r.post_type).trim() || "Service";
    if (!POST_TYPES.includes(postType)) errors.push(`post_type must be one of ${POST_TYPES.join(", ")}`);
    const extras = calendarExtras({
      time: toTime(r.time), primary_keyword: cellText(r.primary_keyword), secondary_keywords: cellText(r.secondary_keywords),
      tertiary_keywords: cellText(r.tertiary_keywords), button: cellText(r.button),
    });
    if (cellText(r.button).trim() && !extras.cta) errors.push(`button must be one of ${CTAS.join(", ")}`);
    out.push({ row: i + 2, client_id: client?.id || null, client: client?.business_name || ref, date, post_type: postType, topic: cellText(r.topic).trim().slice(0, 200) || null, ...extras, errors });
  });

  // posting-plan caps per client (all dates together)
  const groups = new Map();
  for (const r of out) if (!r.errors.length) (groups.get(r.client_id) || groups.set(r.client_id, []).get(r.client_id)).push(r);
  for (const [cid, list] of groups) {
    try {
      await assertCanSchedule(cid, list.map((r) => r.date));
    } catch (e) {
      list.forEach((r) => r.errors.push(e.message));
    }
  }
  const valid = out.filter((r) => !r.errors.length);
  const summary = { total: out.length, valid: valid.length, invalid: out.length - valid.length };
  if (!commit || summary.invalid) return { committed: false, summary, rows: out };

  let inserted = 0;
  for (const [cid, list] of groups) {
    const t = await one("SELECT tenant_id FROM clients WHERE id=?", [cid]);
    await withPlanLock(cid, async () => {
      await assertCanSchedule(cid, list.map((r) => r.date));
      for (const r of list) {
        await insert("content_calendar", {
          tenant_id: t.tenant_id, client_id: cid, scheduled_date: r.date, post_type: r.post_type, topic: r.topic,
          scheduled_time: r.scheduled_time, primary_keyword: r.primary_keyword, secondary_keywords: r.secondary_keywords,
          tertiary_keywords: r.tertiary_keywords, cta: r.cta, source: "excel", status: "SCHEDULED", assigned_employee_id: employeeId,
        });
        inserted++;
      }
    });
  }
  return { committed: true, summary: { ...summary, inserted }, rows: out };
}
