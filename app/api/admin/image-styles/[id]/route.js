import { route } from "@/lib/saas/routeKit.js";
import { one, query } from "@/lib/db";
import { saveStyle } from "@/lib/images/styles.js";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const PATCH = route({ superAdmin: true }, async ({ ctx, params, request }) => {
  const id = Number(params.id);
  if (!(await one("SELECT id FROM image_styles WHERE id=?", [id]))) throw Object.assign(new Error("Style not found"), { status: 404 });
  const b = await request.json().catch(() => ({}));
  const style = await saveStyle(id, b);
  await audit(ctx, "IMAGE_STYLE_UPDATED", { entity: "image_style", entityId: id, meta: { name: style.name } });
  return { style };
});

/** Delete: clients using it fall back to the default style. The default style can't be deleted. */
export const DELETE = route({ superAdmin: true }, async ({ ctx, params }) => {
  const id = Number(params.id);
  const s = await one("SELECT * FROM image_styles WHERE id=?", [id]);
  if (!s) throw Object.assign(new Error("Style not found"), { status: 404 });
  if (s.is_default) throw Object.assign(new Error("Make another style the default first"), { status: 400 });
  await query("UPDATE clients SET image_style_id=NULL WHERE image_style_id=?", [id]);
  await query("DELETE FROM image_styles WHERE id=?", [id]);
  await audit(ctx, "IMAGE_STYLE_DELETED", { entity: "image_style", entityId: id, meta: { name: s.name } });
  return {};
});
