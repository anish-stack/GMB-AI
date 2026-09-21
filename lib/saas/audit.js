import { insert, query } from "../db.js";

export async function audit(ctx, action, { entity = null, entityId = null, meta = null } = {}) {
  try {
    await insert("audit_logs", {
      tenant_id: ctx?.tenantId ?? null,
      user_id: ctx?.userId ?? ctx?.session?.id ?? null,
      user_name: ctx?.session?.name || ctx?.name || "system",
      role: ctx?.role || null,
      action,
      entity,
      entity_id: entityId,
      meta: meta ? JSON.stringify(meta) : null,
    });
  } catch (err) {
    console.error("audit log failed:", err.message);
  }
}

export async function listAudit({ tenantId = null, limit = 100 } = {}) {
  const where = tenantId ? "WHERE a.tenant_id=?" : "";
  const params = tenantId ? [tenantId] : [];
  return query(
    `SELECT a.*, t.name AS tenant_name
       FROM audit_logs a LEFT JOIN tenants t ON t.id=a.tenant_id
       ${where}
      ORDER BY a.id DESC LIMIT ${Number(limit)}`,
    params
  );
}

export async function notify({ tenantId = null, userId = null, type = "INFO", title, body = null, link = null }) {
  try {
    await insert("notifications", {
      tenant_id: tenantId,
      user_id: userId,
      type,
      title,
      body,
      link,
    });
  } catch (err) {
    console.error("notification failed:", err.message);
  }
}
