import { route } from "@/lib/saas/routeKit.js";
import { update } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { autoPublishAllowed, getAutoPublish, AUTO_MIN_SCORE } from "@/lib/posting/autoPublish.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "client.view" }, async ({ ctx, params }) => {
  await assertClientInTenant(Number(params.id), ctx.tenantId);
  const c = await getAutoPublish(Number(params.id));
  const gate = await autoPublishAllowed(ctx.tenantId);
  return { enabled: Boolean(c.auto_publish), min_score: Math.max(AUTO_MIN_SCORE, Number(c.auto_publish_min_score) || AUTO_MIN_SCORE), allowed: gate.allowed, reason: gate.reason };
});

/** PUT { enabled, min_score (80-100) } - owner / manager only (client.edit). */
export const PUT = route({ permission: "client.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  const gate = await autoPublishAllowed(ctx.tenantId);
  if (b.enabled && !gate.allowed) throw Object.assign(new Error(`Auto-publish unavailable: ${gate.reason}`), { status: 403 });
  const patch = {};
  if (b.enabled !== undefined) patch.auto_publish = b.enabled ? 1 : 0;
  if (b.min_score !== undefined) patch.auto_publish_min_score = Math.min(100, Math.max(AUTO_MIN_SCORE, parseInt(b.min_score, 10) || AUTO_MIN_SCORE));
  await update("clients", id, patch);
  await audit(ctx, "AUTO_PUBLISH_CHANGED", { entity: "client", entityId: id, meta: patch });
  const c = await getAutoPublish(id);
  return { enabled: Boolean(c.auto_publish), min_score: Number(c.auto_publish_min_score), allowed: gate.allowed, reason: gate.reason };
});
