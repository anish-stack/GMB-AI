import { route } from "@/lib/saas/routeKit.js";
import { getSettings, setSettings } from "@/lib/saas/settings.js";
import { WEB_SETTING_KEYS } from "@/lib/saas/constants.js";
import { audit } from "@/lib/saas/audit.js";
import { uploadImage } from "@/lib/storage/index.js";

export const dynamic = "force-dynamic";

const pick = (s) => Object.fromEntries(WEB_SETTING_KEYS.map((k) => [k, s[k]]));
const NUMERIC = ["app_disable_right_click", "posting_plan_required", "allow_signup", "maintenance_enabled", "api_enabled", "api_default_rate_per_min", "api_tenant_rate_per_min"];

export const GET = route({ superAdmin: true }, async () => ({ settings: pick(await getSettings({ fresh: true })) }));

/** PATCH { ...keys } - only whitelisted keys are stored. Maintenance changes are audited separately. */
export const PATCH = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const before = await getSettings({ fresh: true });
  const patch = {};
  for (const k of WEB_SETTING_KEYS) {
    if (!(k in b)) continue;
    let v = b[k];
    if (NUMERIC.includes(k)) v = Math.max(0, Math.min(100000, Number(v) || 0));
    else if (k === "social_links") v = Object.fromEntries(Object.entries(v || {}).map(([a, c]) => [a, /^https?:\/\//.test(String(c)) ? String(c).slice(0, 250) : ""]));
    else if (k === "brand_color") v = /^#[0-9a-f]{6}$/i.test(v) ? v : before.brand_color;
    else v = String(v ?? "").slice(0, 4000);
    patch[k] = v;
  }
  if (patch.api_default_rate_per_min !== undefined) patch.api_default_rate_per_min = Math.max(1, patch.api_default_rate_per_min);
  if (patch.api_tenant_rate_per_min !== undefined) patch.api_tenant_rate_per_min = Math.max(1, patch.api_tenant_rate_per_min);
  const settings = await setSettings(patch);
  if ("maintenance_enabled" in patch && Number(before.maintenance_enabled) !== patch.maintenance_enabled) {
    await audit(ctx, patch.maintenance_enabled ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED", { meta: { title: settings.maintenance_title } });
  }
  await audit(ctx, "WEB_SETTINGS_UPDATED", { meta: Object.keys(patch) });
  return { settings: pick(settings) };
});

/** POST multipart { file, kind: logo|favicon } -> uploads and stores the URL. */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const fd = await request.formData();
  const file = fd.get("file");
  const kind = fd.get("kind") === "favicon" ? "favicon_url" : "logo_url";
  if (!file || typeof file === "string") throw Object.assign(new Error("File required"), { status: 400 });
  if (file.size > 2 * 1024 * 1024) throw Object.assign(new Error("Max 2 MB"), { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const webp = buf.toString("ascii", 8, 12) === "WEBP";
  const ico = buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0;
  if (!png && !jpg && !webp && !ico) throw Object.assign(new Error("Use PNG, JPG, WEBP or ICO"), { status: 400 });
  const type = png ? "image/png" : jpg ? "image/jpeg" : webp ? "image/webp" : "image/x-icon";
  const up = await uploadImage(buf, type, `${kind}-${Date.now()}.${png ? "png" : jpg ? "jpg" : webp ? "webp" : "ico"}`);
  const settings = await setSettings({ [kind]: up.url });
  await audit(ctx, "WEB_SETTINGS_UPDATED", { meta: [kind] });
  return { url: up.url, settings: pick(settings) };
});
