import { route } from "@/lib/saas/routeKit.js";
import { listHealth, checkListing, checkAllListings } from "@/lib/gmb/healthMonitor.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = route({ permission: "gmb.view" }, async ({ ctx }) => ({ items: await listHealth(ctx.tenantId) }));

/** POST { client_id? } - check one listing or all of this tenant's listings now. */
export const POST = route({ permission: "gmb.view" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  if (b.client_id) {
    await assertClientInTenant(Number(b.client_id), ctx.tenantId);
    await assertUserRate(ctx.userId, "health-one", 20, 60);
    return { result: await checkListing(Number(b.client_id), { reason: "manual" }) };
  }
  await assertUserRate(ctx.userId, "health-all", 3, 600);
  return { summary: await checkAllListings({ tenantId: ctx.tenantId }), items: await listHealth(ctx.tenantId) };
});
