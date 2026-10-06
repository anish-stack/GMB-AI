import { route } from "@/lib/saas/routeKit.js";
import { update } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { autoPublishAllowed, getAutoPublish, AUTO_MIN_SCORE } from "@/lib/posting/autoPublish.js";
import { audit } from "@/lib/saas/audit.js";
import { query, one } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "client.view" }, async ({ ctx, params }) => {
  await assertClientInTenant(Number(params.id), ctx.tenantId);
  const c = await getAutoPublish(Number(params.id));
  const gate = await autoPublishAllowed(ctx.tenantId);
  return { enabled: Boolean(c.auto_publish), min_score: Math.max(AUTO_MIN_SCORE, Number(c.auto_publish_min_score) || AUTO_MIN_SCORE), allowed: gate.allowed, reason: gate.reason, ...(await diagnostics(Number(params.id), c)) };
});

/** Why automation may not be posting - shown in the card. */
async function diagnostics(clientId, c) {
  const beats = await query("SELECT name, status, last_ok_at, last_run_at FROM system_heartbeats WHERE name IN ('nightly_job','auto_publish','scheduler')").catch(() => []);
  const beat = (n) => {
    const b = beats.find((x) => x.name === n);
    return b ? { ...b, mins_ago: b.last_ok_at ? Math.round((Date.now() - new Date(b.last_ok_at).getTime()) / 60000) : null } : null;
  };
  const plan = await one("SELECT start_date, end_date, posts_per_week, posting_days, status FROM client_posting_plans WHERE client_id=? AND status<>'REPLACED' ORDER BY id DESC LIMIT 1", [clientId]);
  const next = await one("SELECT scheduled_date, scheduled_time FROM content_calendar WHERE client_id=? AND status='SCHEDULED' AND scheduled_date>=CURDATE() ORDER BY scheduled_date, scheduled_time LIMIT 1", [clientId]);
  const waiting = await one("SELECT COUNT(*) n FROM ai_tasks WHERE client_id=? AND status IN ('READY_FOR_REVIEW','APPROVED','NEEDS_REVIEW')", [clientId]);
  const { getSettings } = await import("@/lib/saas/settings.js");
  const mode = (await getSettings()).auto_schedule_mode === "manual" ? "manual" : "plan";
  return { auto_schedule: Boolean(c.auto_schedule), schedule_mode: mode, plan, next, waiting: Number(waiting?.n || 0), scheduler: { nightly: beat("nightly_job"), autopublish: beat("auto_publish"), heartbeat: beat("scheduler") } };
}

/** PUT { enabled, min_score (80-100) } - owner / manager only (client.edit). */
export const PUT = route({ permission: "client.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  const gate = await autoPublishAllowed(ctx.tenantId);
  if (b.enabled && !gate.allowed) throw Object.assign(new Error(`Auto-publish unavailable: ${gate.reason}`), { status: 403 });
  const patch = {};
  if (b.enabled !== undefined) patch.auto_publish = b.enabled ? 1 : 0;
  if (b.auto_schedule !== undefined) patch.auto_schedule = b.auto_schedule ? 1 : 0;
  if (b.min_score !== undefined) patch.auto_publish_min_score = Math.min(100, Math.max(AUTO_MIN_SCORE, parseInt(b.min_score, 10) || AUTO_MIN_SCORE));
  await update("clients", id, patch);
  await audit(ctx, "AUTO_PUBLISH_CHANGED", { entity: "client", entityId: id, meta: patch });
  const c = await getAutoPublish(id);
  return { enabled: Boolean(c.auto_publish), min_score: Number(c.auto_publish_min_score), allowed: gate.allowed, reason: gate.reason, ...(await diagnostics(id, c)) };
});
