import { buildKnowledge } from "./repo/knowledge.js";
import { generatePhoto, aiImagesAvailable } from "./images/imageService.js";
import { resolveEntitlements } from "./saas/entitlements.js";
import { assertCredits, creditCostFor } from "./saas/credits.js";
import { toPublicUrl } from "./utils.js";
import { refillImages } from "./websiteBuilder.js";

/**
 * AI photos for a website built from GMB data:
 *   1 hero + 1 about + 1 per service (max 8).
 * Runs in the background (3 at a time) and then writes the images into the
 * website (hero, about, services) through the builder's prefill "images" mode.
 */
const MAX_SERVICES = 8;

export function plannedImages(prefill) {
  return 2 + Math.min(MAX_SERVICES, (prefill?.services || []).length);
}

/** Throws (before anything is created) if AI images can't be used for this tenant. */
export async function assertAiImagesAllowed(tenantId, count) {
  if (!aiImagesAvailable()) throw Object.assign(new Error("No AI image provider is configured (Gemini / OpenAI / Hugging Face)."), { status: 400 });
  const ent = await resolveEntitlements(tenantId);
  if (ent && !ent.features?.f_image_generation) throw Object.assign(new Error("AI image generation isn't included in your plan."), { status: 403 });
  const unit = Number(await creditCostFor("image").catch(() => 0)) || 0;
  if (unit) await assertCredits(tenantId, unit * count);
  return { count, credits: unit * count };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]).catch(() => null);
    }
  }));
  return out;
}

export async function generateWebsiteImages({ clientId, tenantId, websiteId, prefill }) {
  const kb = await buildKnowledge(clientId);
  const ctx = { tenantId };
  const services = (prefill.services || []).slice(0, MAX_SERVICES);
  const jobs = [
    { key: "hero", subject: `${kb.business} - the team serving customers, welcoming and professional`, tag: "web-hero" },
    { key: "about", subject: `the inside of ${kb.business}: clean, modern ${String(kb.category).toLowerCase()} with the team at work`, tag: "web-about" },
    ...services.map((s) => ({ key: `svc:${s.title}`, subject: `${s.title}${s.description ? ` - ${String(s.description).slice(0, 140)}` : ""}`, tag: "web-svc" })),
  ];
  const results = await pool(jobs, 3, (j) => generatePhoto(kb, { subject: j.subject, tag: j.tag }, ctx));
  const images = { hero: [], about: null, services: {} };
  jobs.forEach((j, i) => {
    const url = toPublicUrl(results[i]?.url);
    if (!url) return;
    if (j.key === "hero") images.hero.push(url);
    else if (j.key === "about") images.about = url;
    else images.services[j.key.slice(4)] = url;
  });
  const made = results.filter(Boolean).length;
  if (made) await refillImages(tenantId, websiteId, images);

  const { sendNotification } = await import("./notifications/service.js");
  await sendNotification({
    tenantId,
    type: made ? "SUCCESS" : "ALERT",
    title: made ? `AI images added to the website - ${kb.business}` : `AI images failed - ${kb.business}`,
    body: made ? `${made} of ${jobs.length} images generated (hero, about and services).` : "No image could be generated. Upload images manually in the builder.",
    link: `/gmb/${clientId}?tab=website`,
    push: true,
  }).catch(() => {});
  return { requested: jobs.length, made };
}
