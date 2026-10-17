import { route } from "@/lib/saas/routeKit.js";
import { one, query } from "@/lib/db";
import { buildKnowledge } from "@/lib/repo/knowledge.js";
import { previewStyleImage, storeStylePreview } from "@/lib/images/imageService.js";
import { cleanStyleInput } from "@/lib/images/styles.js";
import { toPublicUrl } from "@/lib/utils.js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST { client_id, draft?: {mode, overlay, aspect, prompt}, save_preview?: bool, title?, subtitle?, cta? }
 * Renders the style (or the unsaved draft) for a real client. No credits are used.
 */
export const POST = route({ superAdmin: true }, async ({ params, request }) => {
  const id = Number(params.id);
  const b = await request.json().catch(() => ({}));
  const saved = id ? await one("SELECT * FROM image_styles WHERE id=?", [id]) : null;
  const style = { ...(saved || { mode: "BRANDED_PHOTO", overlay: "FULL", aspect: "4:3", prompt: "" }), ...cleanStyleInput(b.draft || {}) };
  const clientId = Number(b.client_id) || (await one("SELECT id FROM clients WHERE active=1 ORDER BY id LIMIT 1"))?.id;
  if (!clientId) throw Object.assign(new Error("Create at least one client to test with"), { status: 400 });
  const kb = await buildKnowledge(clientId);
  const r = await previewStyleImage(kb, style, { title: b.title, subtitle: b.subtitle, cta: b.cta });
  let previewUrl = null;
  if (b.save_preview && saved) {
    const stored = await storeStylePreview(r.buffer, r.contentType, id);
    previewUrl = toPublicUrl(stored.url) || stored.url;
    await query("UPDATE image_styles SET preview_url=? WHERE id=?", [previewUrl, id]);
  }
  return { image: `data:${r.contentType};base64,${Buffer.from(r.buffer).toString("base64")}`, prompt: r.prompt, provider: r.provider, preview_url: previewUrl };
});
