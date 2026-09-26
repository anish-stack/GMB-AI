import { route } from "@/lib/saas/routeKit.js";
import { locateListing, setListing } from "@/lib/rank/grid.js";
import { assertUserRate } from "@/lib/api/rateLimiter.js";

export const dynamic = "force-dynamic";

/** GET ?client_id=&q= -> Google listing candidates for this client */
export const GET = route({ permission: "gmb.view" }, async ({ ctx, request }) => {
  const sp = new URL(request.url).searchParams;
  await assertUserRate(ctx.userId, "rank-locate", 20, 300);
  return await locateListing(Number(sp.get("client_id")), ctx.tenantId, (sp.get("q") || "").slice(0, 120) || null);
});

/** POST { client_id, place_id, lat, lng } -> save the chosen listing */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  await setListing(Number(b.client_id), ctx.tenantId, { place_id: b.place_id, lat: Number(b.lat), lng: Number(b.lng) });
  return {};
});
