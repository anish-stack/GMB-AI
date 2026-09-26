import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query, one, insert, update } from "../db.js";

export const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "GMB", "API", "FEATURE"];
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT", "RESOLVED", "CLOSED"];

const DIR = process.env.SUPPORT_STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "support");
const MAX_FILE = 5 * 1024 * 1024;
const MAX_FILES = 3;
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

/** Magic-byte check - never trust the browser's content-type. */
function sniff(buf) {
  const h = buf.subarray(0, 12);
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return ["image/png", "png"];
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return ["image/jpeg", "jpg"];
  if (h.toString("ascii", 0, 4) === "GIF8") return ["image/gif", "gif"];
  if (h.toString("ascii", 0, 4) === "RIFF" && h.toString("ascii", 8, 12) === "WEBP") return ["image/webp", "webp"];
  if (h.toString("ascii", 0, 5) === "%PDF-") return ["application/pdf", "pdf"];
  return null;
}

/** files: File[] from a multipart request. Returns [{key,name,size,type}]. */
export async function saveAttachments(files = []) {
  const list = files.filter((f) => f && typeof f.arrayBuffer === "function" && f.size > 0);
  if (list.length > MAX_FILES) throw bad(`Max ${MAX_FILES} attachments per message.`);
  const out = [];
  await fs.mkdir(DIR, { recursive: true });
  for (const f of list) {
    if (f.size > MAX_FILE) throw bad(`${f.name} is larger than 5 MB.`);
    const buf = Buffer.from(await f.arrayBuffer());
    const kind = sniff(buf);
    if (!kind) throw bad(`${f.name}: only PNG, JPG, GIF, WEBP or PDF files are allowed.`);
    const key = `${crypto.randomUUID()}.${kind[1]}`;
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ DIR, key), buf);
    out.push({ key, name: String(f.name || key).replace(/[^\w.\- ]/g, "_").slice(0, 120), size: buf.length, type: kind[0] });
  }
  return out;
}

export async function readAttachment(key) {
  const safe = path.basename(String(key || ""));
  if (!/^[0-9a-f-]{36}\.(png|jpg|gif|webp|pdf)$/.test(safe)) throw bad("Not found", 404);
  return fs.readFile(path.join(/*turbopackIgnore: true*/ DIR, safe));
}

/** Parses JSON or multipart bodies into { fields, files }. */
export async function readTicketBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("multipart/form-data")) {
    const fd = await request.formData();
    const fields = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") fields[k] = v;
    return { fields, files: fd.getAll("files").filter((v) => typeof v !== "string") };
  }
  return { fields: await request.json().catch(() => ({})), files: [] };
}

async function nextTicketNo() {
  const r = await one("SELECT MAX(id) id FROM support_tickets");
  return `TKT-${String(Number(r?.id || 0) + 1001).padStart(5, "0")}`;
}

export async function createTicket({ tenantId, user, subject, category, priority, message, clientId = null, files = [] }) {
  const s = String(subject || "").trim();
  const m = String(message || "").trim();
  if (s.length < 4) throw bad("Subject is too short.");
  if (m.length < 10) throw bad("Please describe the issue (at least 10 characters).");
  if (clientId) {
    const c = await one("SELECT id FROM clients WHERE id=? AND tenant_id=?", [Number(clientId), tenantId]);
    if (!c) throw bad("Client not found", 404);
  }
  const attachments = await saveAttachments(files);
  const id = await insert("support_tickets", {
    ticket_no: await nextTicketNo(),
    tenant_id: tenantId,
    client_id: clientId ? Number(clientId) : null,
    user_id: user.id,
    subject: s.slice(0, 200),
    category: CATEGORIES.includes(category) ? category : "GENERAL",
    priority: PRIORITIES.includes(priority) ? priority : "MEDIUM",
    status: "OPEN",
    last_reply_by: "CLIENT",
    last_reply_at: new Date(),
  });
  await insert("support_ticket_messages", { ticket_id: id, user_id: user.id, author_role: "CLIENT", author_name: user.name, body: m.slice(0, 10000), attachments: attachments.length ? JSON.stringify(attachments) : null });
  return getTicket(id);
}

export async function getTicket(id, { tenantId = null, includeInternal = false } = {}) {
  const t = await one(
    `SELECT t.*, tn.name tenant_name, c.business_name client_name, u.name user_name, u.email user_email, a.name assignee_name
       FROM support_tickets t JOIN tenants tn ON tn.id=t.tenant_id
       LEFT JOIN clients c ON c.id=t.client_id LEFT JOIN users u ON u.id=t.user_id LEFT JOIN users a ON a.id=t.assigned_to_user_id
      WHERE t.id=? ${tenantId ? "AND t.tenant_id=?" : ""}`,
    tenantId ? [Number(id), tenantId] : [Number(id)],
  );
  if (!t) throw bad("Ticket not found", 404);
  const messages = await query(
    `SELECT id, author_role, author_name, body, attachments, is_internal, created_at FROM support_ticket_messages
      WHERE ticket_id=? ${includeInternal ? "" : "AND is_internal=0"} ORDER BY id`,
    [t.id],
  );
  return { ...t, messages: messages.map((m) => ({ ...m, attachments: m.attachments ? JSON.parse(m.attachments) : [] })) };
}

export async function listTickets({ tenantId = null, status = null, priority = null, category = null, q = null, assignee = null, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (tenantId) { where.push("t.tenant_id=?"); params.push(tenantId); }
  if (status && STATUSES.includes(status)) { where.push("t.status=?"); params.push(status); }
  if (status === "ACTIVE") where.push("t.status NOT IN ('RESOLVED','CLOSED')");
  if (priority && PRIORITIES.includes(priority)) { where.push("t.priority=?"); params.push(priority); }
  if (category && CATEGORIES.includes(category)) { where.push("t.category=?"); params.push(category); }
  if (assignee) { where.push("t.assigned_to_user_id=?"); params.push(Number(assignee)); }
  if (q) { where.push("(t.subject LIKE ? OR t.ticket_no LIKE ? OR tn.name LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const items = await query(
    `SELECT t.id, t.ticket_no, t.subject, t.category, t.priority, t.status, t.last_reply_by, t.last_reply_at, t.created_at, t.updated_at,
            tn.name tenant_name, t.tenant_id, c.business_name client_name, a.name assignee_name
       FROM support_tickets t JOIN tenants tn ON tn.id=t.tenant_id LEFT JOIN clients c ON c.id=t.client_id LEFT JOIN users a ON a.id=t.assigned_to_user_id
      ${w} ORDER BY FIELD(t.status,'OPEN','IN_PROGRESS','WAITING_FOR_CLIENT','RESOLVED','CLOSED'), FIELD(t.priority,'URGENT','HIGH','MEDIUM','LOW'), t.updated_at DESC
      LIMIT ${Math.min(Number(limit) || 50, 200)} OFFSET ${Number(offset) || 0}`,
    params,
  );
  const [{ total }] = await query(`SELECT COUNT(*) total FROM support_tickets t JOIN tenants tn ON tn.id=t.tenant_id ${w}`, params);
  return { items, total: Number(total) };
}

export async function replyToTicket(ticketId, { user, role, body, files = [], internal = false, tenantId = null }) {
  const t = await one(`SELECT * FROM support_tickets WHERE id=? ${tenantId ? "AND tenant_id=?" : ""}`, tenantId ? [Number(ticketId), tenantId] : [Number(ticketId)]);
  if (!t) throw bad("Ticket not found", 404);
  const text = String(body || "").trim();
  if (!text) throw bad("Message can't be empty.");
  if (role === "CLIENT" && t.status === "CLOSED") throw bad("This ticket is closed. Open a new ticket.");
  const attachments = await saveAttachments(files);
  await insert("support_ticket_messages", { ticket_id: t.id, user_id: user.id, author_role: role, author_name: user.name, body: text.slice(0, 10000), attachments: attachments.length ? JSON.stringify(attachments) : null, is_internal: internal && role === "ADMIN" ? 1 : 0 });
  if (!internal) {
    const status = role === "ADMIN" ? (t.status === "OPEN" ? "IN_PROGRESS" : t.status) : ["WAITING_FOR_CLIENT", "RESOLVED"].includes(t.status) ? "OPEN" : t.status;
    await update("support_tickets", t.id, { last_reply_by: role, last_reply_at: new Date(), status });
  }
  return t;
}

export async function updateTicketMeta(ticketId, { status, priority, assigned_to_user_id }) {
  const t = await one("SELECT * FROM support_tickets WHERE id=?", [Number(ticketId)]);
  if (!t) throw bad("Ticket not found", 404);
  const patch = {};
  if (status && STATUSES.includes(status)) {
    patch.status = status;
    patch.closed_at = status === "CLOSED" ? new Date() : null;
  }
  if (priority && PRIORITIES.includes(priority)) patch.priority = priority;
  if (assigned_to_user_id !== undefined) patch.assigned_to_user_id = assigned_to_user_id ? Number(assigned_to_user_id) : null;
  if (Object.keys(patch).length) await update("support_tickets", t.id, patch);
  return { before: t, patch };
}
