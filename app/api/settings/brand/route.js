import { route } from "@/lib/saas/routeKit.js";
import { query, one } from "@/lib/db";
import { audit } from "@/lib/saas/audit.js";
import { uploadImage } from "@/lib/storage/index.js";
import { toPublicUrl } from "@/lib/utils.js";

export const dynamic = "force-dynamic";

/**
 * White-label for an agency workspace.
 * PUT { brand_name | null } - name shown instead of the platform name (panel, emails, PDF reports).
 * POST multipart { file } - brand logo (PNG / JPG / WEBP, max 1 MB) · DELETE - remove logo.
 */
export const GET = route({ permission: "settings.view" }, async ({ ctx }) => {
  const t = await one("SELECT brand_name, brand_logo_url FROM tenants WHERE id=?", [ctx.tenantId]);
  return { brand_name: t?.brand_name || "", brand_logo_url: t?.brand_logo_url || null };
});

export const PUT = route({ permission: "settings.edit" }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const name = String(b.brand_name ?? "").replace(/[<>]/g, "").trim().slice(0, 60) || null;
  await query("UPDATE tenants SET brand_name=? WHERE id=?", [name, ctx.tenantId]);
  await audit(ctx, "BRAND_NAME_CHANGED", { meta: { brand_name: name } });
  return { brand_name: name || "" };
});

export const POST = route({ permission: "settings.edit" }, async ({ ctx, request }) => {
  const fd = await request.formData();
  const file = fd.get("file");
  if (!file || typeof file === "string") throw Object.assign(new Error("Choose an image"), { status: 400 });
  if (file.size > 1024 * 1024) throw Object.assign(new Error("Logo must be 1 MB or smaller"), { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const webp = buf.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpg && !webp) throw Object.assign(new Error("Use a PNG, JPG or WEBP image"), { status: 400 });
  const type = png ? "image/png" : jpg ? "image/jpeg" : "image/webp";
  const up = await uploadImage(buf, type, `brand-t${ctx.tenantId}-${Date.now()}.${png ? "png" : jpg ? "jpg" : "webp"}`);
  const url = toPublicUrl(up.url) || up.url;
  await query("UPDATE tenants SET brand_logo_url=? WHERE id=?", [url, ctx.tenantId]);
  await audit(ctx, "BRAND_LOGO_CHANGED", {});
  return { brand_logo_url: url };
});

export const DELETE = route({ permission: "settings.edit" }, async ({ ctx }) => {
  await query("UPDATE tenants SET brand_logo_url=NULL WHERE id=?", [ctx.tenantId]);
  await audit(ctx, "BRAND_LOGO_REMOVED", {});
  return { brand_logo_url: null };
});
