import { route } from "@/lib/saas/routeKit.js";
import { one, update } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { getSettings } from "@/lib/saas/settings.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "client.view" }, async ({ ctx, params }) => {
  await assertClientInTenant(Number(params.id), ctx.tenantId);
  const c = await one("SELECT auto_reply_reviews, auto_reply_min_stars FROM clients WHERE id=?", [Number(params.id)]);
  const s = await getSettings();
  return { auto_reply: Boolean(c.auto_reply_reviews), min_stars: Number(c.auto_reply_min_stars || 4), platform_allowed: Number(s.review_auto_reply_enabled) === 1 };
});

/** PUT { auto_reply: bool, min_stars: 1-5 } */
export const PUT = route({ permission: "client.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  const patch = {};
  if (b.auto_reply !== undefined) patch.auto_reply_reviews = b.auto_reply ? 1 : 0;
  if (b.min_stars !== undefined) patch.auto_reply_min_stars = Math.min(Math.max(parseInt(b.min_stars, 10) || 4, 1), 5);
  await update("clients", id, patch);
  await audit(ctx, "REVIEW_AUTO_REPLY_CHANGED", { entity: "client", entityId: id, meta: patch });
  const c = await one("SELECT auto_reply_reviews, auto_reply_min_stars FROM clients WHERE id=?", [id]);
  return { auto_reply: Boolean(c.auto_reply_reviews), min_stars: Number(c.auto_reply_min_stars) };
});
