import { after } from "next/server";
import { route } from "@/lib/saas/routeKit.js";
import { createScan, runScan, listScans } from "@/lib/rank/grid.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = route({ permission: "gmb.view" }, async ({ ctx, request }) => ({
  items: await listScans(ctx.tenantId, { clientId: new URL(request.url).searchParams.get("client_id") }),
}));

/** POST { client_id, keyword, grid_size: 3|5|7, spacing_km } -> runs in the background; poll GET /api/rank/scans/:id */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  await assertClientInTenant(Number(b.client_id), ctx.tenantId);
  const id = await createScan({ clientId: Number(b.client_id), tenantId: ctx.tenantId, keyword: b.keyword, gridSize: b.grid_size, spacingKm: b.spacing_km, actor: ctx.name });
  after(() => runScan(id).catch(() => {}));
  await audit(ctx, "RANK_SCAN_STARTED", { entity: "client", entityId: Number(b.client_id), meta: { keyword: b.keyword, grid: b.grid_size } });
  return { id };
});
