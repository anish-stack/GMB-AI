import { route } from "@/lib/saas/routeKit.js";
import { query, insert, update } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** History of broadcasts with delivery / read stats. */
export const GET = route({ superAdmin: true }, async () => {
  const items = await query(
    `SELECT b.*, (SELECT COUNT(*) FROM notifications n WHERE n.broadcast_id=b.id AND n.is_read=1) AS read_total
       FROM notification_broadcasts b ORDER BY b.id DESC LIMIT 100`,
  );
  const tenants = await query("SELECT id, name FROM tenants ORDER BY name");
  const users = await query("SELECT u.id, u.name, u.email, t.name tenant FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.active=1 ORDER BY t.name, u.name LIMIT 2000");
  return { items: items.map((b) => ({ ...b, audience: b.audience ? JSON.parse(b.audience) : [] })), tenants, users };
});

/**
 * { type, title, body?, link?, audience_type: ALL|TENANTS|USERS, ids?: number[], push? }
 * One-tenant send = TENANTS with a single id.
 */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const title = String(b.title || "").trim();
  if (title.length < 3) throw Object.assign(new Error("Title is required."), { status: 400 });
  const type = ["ANNOUNCEMENT", "MAINTENANCE", "ALERT", "INFO"].includes(b.type) ? b.type : "ANNOUNCEMENT";
  const audienceType = ["ALL", "TENANTS", "USERS"].includes(b.audience_type) ? b.audience_type : "ALL";
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(Number).filter(Boolean))].slice(0, 5000) : [];
  if (audienceType !== "ALL" && !ids.length) throw Object.assign(new Error("Pick at least one recipient."), { status: 400 });
  const link = b.link && String(b.link).startsWith("/") ? String(b.link).slice(0, 250) : null;
  const push = b.push !== false;

  const id = await insert("notification_broadcasts", {
    type, title: title.slice(0, 220), body: b.body ? String(b.body).slice(0, 1000) : null, link,
    audience_type: audienceType, audience: JSON.stringify(ids), send_push: push ? 1 : 0,
    created_by_user_id: ctx.userId, created_by_name: ctx.name,
  });
  const res = await sendNotification({
    all: audienceType === "ALL",
    tenantIds: audienceType === "TENANTS" ? ids : null,
    userIds: audienceType === "USERS" ? ids : null,
    type, title, body: b.body, link, push, broadcastId: id,
  });
  await update("notification_broadcasts", id, { recipients: res.recipients, push_sent: res.push.sent, push_failed: res.push.failed });
  await audit(ctx, "NOTIFICATION_SENT", { entity: "broadcast", entityId: id, meta: { type, audienceType, recipients: res.recipients, push: res.push } });
  return { id, ...res };
});
