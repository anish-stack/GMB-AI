import { route } from "@/lib/saas/routeKit.js";
import { listStyles, saveStyle, PLACEHOLDERS, MODES, OVERLAYS, ASPECTS, SEED_STYLES } from "@/lib/images/styles.js";
import { query } from "@/lib/db";
import { audit } from "@/lib/saas/audit.js";

export const dynamic = "force-dynamic";

export const GET = route({ superAdmin: true }, async () => {
  const items = await listStyles();
  const usage = await query("SELECT image_style_id id, COUNT(*) n FROM clients WHERE image_style_id IS NOT NULL GROUP BY image_style_id").catch(() => []);
  const used = Object.fromEntries(usage.map((u) => [u.id, Number(u.n)]));
  return { items: items.map((s) => ({ ...s, clients: used[s.id] || 0 })), placeholders: PLACEHOLDERS, modes: MODES, overlays: OVERLAYS, aspects: ASPECTS, seeds: SEED_STYLES };
});

/** POST { name, description, mode, overlay, aspect, prompt, active, is_default } */
export const POST = route({ superAdmin: true }, async ({ ctx, request }) => {
  const b = await request.json().catch(() => ({}));
  const style = await saveStyle(null, b);
  await audit(ctx, "IMAGE_STYLE_CREATED", { entity: "image_style", entityId: style.id, meta: { name: style.name, mode: style.mode } });
  return { style };
});
