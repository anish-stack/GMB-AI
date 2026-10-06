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

/**
 * POST { client_id, keyword | keywords: [] (or "a, b, c"), grid_size: 3|5|7, spacing_km }
 * One scan per keyword (max 10 per request), all run in the background one after another.
 */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  await assertClientInTenant(Number(b.client_id), ctx.tenantId);
  const raw = Array.isArray(b.keywords) ? b.keywords.join(",") : String(b.keywords || b.keyword || "");
  const keywords = [...new Set(raw.split(/[,\n;]/).map((k) => k.trim()).filter((k) => k.length >= 2))].slice(0, 10);
  if (!keywords.length) throw Object.assign(new Error("Enter at least one keyword."), { status: 400 });
  const ids = [];
  const failed = [];
  for (const keyword of keywords) {
    try {
      ids.push(await createScan({ clientId: Number(b.client_id), tenantId: ctx.tenantId, keyword, gridSize: b.grid_size, spacingKm: b.spacing_km, actor: ctx.name }));
    } catch (e) {
      // first keyword failing (no key / listing not linked) -> report it like before
      if (!ids.length && failed.length === 0 && keywords.length === 1) throw e;
      failed.push({ keyword, error: e.message });
      if (e.status === 409 || e.status === 400 || e.status === 503) break;
    }
  }
  if (!ids.length) throw Object.assign(new Error(failed[0]?.error || "Could not start the scans."), { status: 400 });
  // sequential, so the Places API isn't hit by many grids at once
  after(async () => {
    for (const id of ids) await runScan(id).catch(() => {});
  });
  await audit(ctx, "RANK_SCAN_STARTED", { entity: "client", entityId: Number(b.client_id), meta: { keywords: keywords.length, grid: b.grid_size } });
  return { id: ids[0], ids, failed };
});
