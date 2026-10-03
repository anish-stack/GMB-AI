import { after } from "next/server";
import { route } from "@/lib/saas/routeKit.js";
import { importLocations } from "@/lib/gmb/bulkConnect.js";
import { importFromGoogle } from "@/lib/gmb/importFromGoogle.js";
import { resolveEntitlements, assertLimit } from "@/lib/saas/entitlements.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST { locations: [name...], plan: { start_date, duration_months, posts_per_week, total_posts?, posting_days? } } */
export const POST = route({ permission: "gmb.connect" }, async ({ ctx, request, params }) => {
  const b = await request.json().catch(() => ({}));
  const picks = Array.isArray(b.locations) ? b.locations : [];
  const ent = await resolveEntitlements(ctx.tenantId);
  assertLimit(ent, "max_clients", picks.length);
  const res = await importLocations({ tenantId: ctx.tenantId, connectionId: params.cid, picks, plan: b.plan, actor: ctx.name });
  // pull services / keywords / logo / links for each new client in the background
  after(async () => {
    for (const c of res.created) await importFromGoogle(c.client_id).catch((e) => console.error("[bulk import]", c.client_id, e.message));
  });
  await audit(ctx, "GMB_BULK_IMPORT", { meta: { connection: Number(params.cid), created: res.created.length, skipped: res.skipped.length } });
  return res;
});
