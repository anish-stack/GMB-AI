import { route } from "@/lib/saas/routeKit.js";
import { query } from "@/lib/db";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

/** PUT { color: "#RRGGBB" | null } - workspace panel colour (null = default). */
export const PUT = route({ permission: "settings.edit" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const color = b.color ? String(b.color).trim() : null;
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) throw Object.assign(new Error("Use a colour like #2563EB"), { status: 400 });
  await query("UPDATE tenants SET theme_color=? WHERE id=?", [color, ctx.tenantId]);
  await audit(ctx, "THEME_COLOR_CHANGED", { meta: { color } });
  return { color };
});
