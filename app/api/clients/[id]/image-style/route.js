import { route } from "@/lib/saas/routeKit.js";
import { one, query } from "@/lib/db";
import { assertClientInTenant } from "@/lib/repo/clients.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ permission: "gmb.view" }, async ({ ctx, params }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const c = await one("SELECT image_style_id FROM clients WHERE id=?", [id]);
  return { style_id: c?.image_style_id || null };
});

/** PUT { style_id | null } - null = use the admin's default style */
export const PUT = route({ permission: "gmb.edit" }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  await assertClientInTenant(id, ctx.tenantId);
  const b = await request.json().catch(() => ({}));
  const sid = b.style_id ? Number(b.style_id) : null;
  if (sid && !(await one("SELECT id FROM image_styles WHERE id=? AND active=1", [sid]))) throw Object.assign(new Error("Style not available"), { status: 400 });
  await query("UPDATE clients SET image_style_id=? WHERE id=?", [sid, id]);
  await audit(ctx, "CLIENT_IMAGE_STYLE_CHANGED", { entity: "client", entityId: id, meta: { style_id: sid } });
  return { style_id: sid };
});
