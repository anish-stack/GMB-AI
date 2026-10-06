import { route } from "@/lib/saas/routeKit.js";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { listTracked, suggestions, track, untrack, trackedLimit } from "@/lib/keywords/tracked.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "gmb.view" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const [tracked, sugg, limit] = await Promise.all([listTracked(id), suggestions(id), trackedLimit(ctx.tenantId)]);
  return { tracked, suggestions: sugg, limit };
});

/** POST { action: "add", keywords: "a, b" | [] } | { action: "remove", id } */
export const POST = route({ permission: "gmb.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  if (b.action === "remove") {
    await untrack(id, b.id);
    return {};
  }
  const list = (Array.isArray(b.keywords) ? b.keywords : String(b.keywords || "").split(/[,\n]/)).map((k) => String(k).trim()).filter(Boolean);
  if (!list.length) throw Object.assign(new Error("Type at least one keyword."), { status: 400 });
  return track(id, ctx.tenantId, list.slice(0, 50));
});
