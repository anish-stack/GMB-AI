import "server-only";
import crypto from "crypto";
import { getImageChain, logAgentExecution, chargeAgent } from "../ai/index.js";
import { uploadImage } from "../storage/index.js";
import * as imagePrompt from "../ai/prompts/image.js";
import { renderCreative, renderLogoOverlay, toDataUrl } from "./creative.js";
import { resolveStyle, renderStyle, styleVars, imageButtonEnabled, withoutButton } from "./styles.js";
import { one } from "../db.js";
import { fitText, IMAGE_TITLE_MAX_CHARS } from "../ai/textPolicy.js";

/**
 * ImageService - AI-provider-agnostic AND storage-provider-agnostic, never throws.
 *
 * Generated images are uploaded through lib/storage (S3 -> R2 -> Cloudinary ->
 * disk fallback chain) and only a short URL + the storage provider/key are
 * stored in the database. A 1.2 MB JPEG becomes a ~1.7 MB base64 string, which
 * is larger than MySQL's default max_allowed_packet (1 MB in XAMPP) and kills
 * the connection with "write ECONNRESET" mid-pipeline - hence storing the file
 * externally and only keeping a URL.
 *
 * Only the small SVG placeholder stays inline as a data URL.
 *
 * Every attempt is logged to ai_executions as agent "image".
 */
const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

/** Whether this provider has an image model actually set up (HF needs it explicit; OpenAI/Gemini ship a default). */
function hasImageModel(p) {
  if (p.name === "huggingface") return Boolean(process.env.HF_IMAGE_MODEL);
  return Boolean(p.imageModel);
}

/** Images: Gemini only by default (IMAGE_PROVIDER), never Ollama / Mock. */
function imageCandidateProviders() {
  return getImageChain().filter(
    (p) => typeof p.image === "function" && p.name !== "mock" && p.isConfigured() && hasImageModel(p)
  );
}

/**
 * Branded creative: client logo + post title + CTA bar over the AI photo.
 * Returns a stored image result, or null if rendering failed.
 */
async function brandedResult(kb, { topic, title, subtitle, cta }, ctx, photo = null, photoType = null, aiProvider = "none") {
  try {
    const c = await one("SELECT business_name, city, logo_url, brand_color FROM clients WHERE id=?", [kb.client_id]);
    const png = await renderCreative({
      photo,
      photoType: photoType || "image/png",
      logo: await toDataUrl(c?.logo_url),
      business: c?.business_name || kb.business,
      city: c?.city || kb.city,
      title: fitText(title || topic || kb.business, IMAGE_TITLE_MAX_CHARS),
      subtitle: subtitle ? fitText(subtitle, 60) : null,
      cta: cta ? fitText(cta, 22) : null,
      brand: /^#[0-9a-f]{6}$/i.test(c?.brand_color || "") ? c.brand_color : "#0B2A5B",
    });
    const stored = await saveImage(png, "image/png", ctx.taskId, `${ctx.tag || ""}brand`);
    return {
      url: stored.url,
      provider: `branded+${aiProvider}`,
      storageProvider: stored.provider,
      storageKey: stored.key,
      placeholder: false,
      note: photo ? null : "Branded design without AI photo (no image provider configured)",
      bytes: png.length,
      contentHash: crypto.createHash("sha256").update(png).digest("hex"),
    };
  } catch (err) {
    console.error("[image] branded render failed:", err.message);
    return null;
  }
}

/** Generates ONE image and returns it - the original single-image entry point. */
export async function generateImage(kb, { topic, service, concept, title = null, subtitle = null, cta = null }, ctx = {}) {
  // admin-managed image style (Admin -> Image styles); client's pick or ctx.styleId wins
  const style = await resolveStyle(kb.client_id, ctx.styleId || null);
  const client = await one("SELECT brand_color, logo_url, business_name FROM clients WHERE id=?", [kb.client_id]).catch(() => null);
  // CTA button on the image only when the admin turned it on (Web settings -> "Button on post images")
  const showButton = await imageButtonEnabled();
  const basePrompt = style.prompt?.trim()
    ? renderStyle(showButton ? style.prompt : withoutButton(style.prompt), styleVars(kb, { topic, service, concept, title, subtitle, cta }, client?.brand_color))
    : imagePrompt.build(kb, { topic, service, concept });
  const prompt = showButton || style.prompt?.trim() ? basePrompt : withoutButton(basePrompt);
  const brand = { topic, title, subtitle, cta: showButton ? cta : null };

  if (ctx.imagesEnabled === false) {
    const reason = "AI image generation is not included in this plan";
    await log(ctx, kb, { provider: "none", model: "none", status: "SKIPPED", error: reason, prompt });
    const branded = await brandedResult(kb, brand, ctx);
    if (branded) return { ...branded, prompt };
    return { ...placeholder(kb, topic), prompt, note: `Image generation skipped: ${reason}` };
  }

  // Gemini only by default (IMAGE_PROVIDER=auto adds OpenAI / Hugging Face).
  const candidates = imageCandidateProviders();

  if (!candidates.length) {
    const reason = "No image AI configured - set GEMINI_API_KEY (Admin -> Integrations -> Gemini)";
    await log(ctx, kb, { provider: "none", model: "none", status: "SKIPPED", error: reason, prompt });
    const branded = await brandedResult(kb, brand, ctx);
    if (branded) return { ...branded, prompt };
    return { ...placeholder(kb, topic), prompt, note: `Image generation skipped: ${reason}` };
  }

  let lastError = null;
  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i];
    const started = Date.now();
    try {
      const result = await provider.image(prompt, { aspectRatio: style.aspect || "4:3" });
      let { buffer, contentType } = toBuffer(result);
      if (style.mode !== "BRANDED_PHOTO") {
        // AI-designed poster / clean photo: optionally just the client's logo on top
        if (style.overlay === "LOGO") {
          const withLogo = await renderLogoOverlay({ photo: buffer, photoType: contentType, logo: await toDataUrl(client?.logo_url), business: client?.business_name }).catch(() => null);
          if (withLogo) {
            buffer = withLogo;
            contentType = "image/png";
          }
        }
      }
      // compose logo + title + CTA over the AI photo; raw photo only if that fails
      const branded = style.mode === "BRANDED_PHOTO" ? await brandedResult(kb, brand, ctx, buffer, contentType, `${provider.name}:${result.model || provider.imageModel}`) : null;
      if (branded) {
        await chargeAgent({ agent: "image", clientId: kb.client_id, tenantId: ctx.tenantId || null, taskId: ctx.taskId || null });
        await log(ctx, kb, { provider: `${provider.name}:${result.endpoint || "inference"}`, model: result.model || provider.imageModel, status: i > 0 ? "FALLBACK" : "SUCCESS", duration: Date.now() - started, prompt, output: `${branded.url} branded (${Math.round(branded.bytes / 1024)} KB)` });
        return { ...branded, prompt };
      }
      const stored = await saveImage(buffer, contentType, ctx.taskId, ctx.tag);
      await chargeAgent({ agent: "image", clientId: kb.client_id, tenantId: ctx.tenantId || null, taskId: ctx.taskId || null });

      await log(ctx, kb, {
        provider: `${provider.name}:${result.endpoint || "inference"}`,
        model: result.model || provider.imageModel,
        status: i > 0 ? "FALLBACK" : "SUCCESS",
        duration: Date.now() - started,
        prompt,
        output: `${stored.url} via ${stored.provider}${stored.fallback ? " (storage fallback)" : ""} (${Math.round(buffer.length / 1024)} KB ${contentType})`,
      });

      return {
        url: stored.url,
        provider: `${style.mode === "AI_POSTER" ? "poster" : "photo"}+${provider.name}:${result.model || provider.imageModel}`,
        storageProvider: stored.provider,
        storageKey: stored.key,
        prompt,
        placeholder: false,
        note: null,
        bytes: buffer.length,
        // sha256 of the actual image bytes - used to catch the AI provider (or the
        // placeholder) handing back the exact same picture it gave a previous task.
        contentHash: crypto.createHash("sha256").update(buffer).digest("hex"),
      };
    } catch (err) {
      lastError = err;
      await log(ctx, kb, {
        provider: provider.name,
        model: provider.imageModel,
        status: "FAILED",
        duration: Date.now() - started,
        error: String(err.message).slice(0, 900),
        prompt,
      });
      // fall through to the next provider in the chain
    }
  }

  const branded = await brandedResult(kb, brand, ctx);
  if (branded) return { ...branded, prompt, note: `AI photo failed (${String(lastError?.message || "").slice(0, 120)}) - branded design used` };
  return {
    ...placeholder(kb, topic),
    prompt,
    storageProvider: null,
    storageKey: null,
    note: `Image failed: ${String(lastError?.message || "all image providers failed").slice(0, 200)}`,
  };
}

/**
 * Generates `count` independent image options in parallel for the reviewer
 * to pick from. Each call goes through the full generateImage() AI-provider
 * fallback chain on its own, so one slow/failing provider on one of them
 * doesn't take the others down with it.
 */
export async function generateImageOptions(kb, { topic, service, concept, title = null, subtitle = null, cta = null }, ctx = {}, count = 3) {
  const n = Math.max(1, Math.min(Number(count) || 1, 6));
  const results = await Promise.all(
    Array.from({ length: n }, (_, i) => generateImage(kb, { topic, service, concept, title, subtitle, cta }, { ...ctx, tag: `opt${i + 1}` }))
  );
  return results;
}

/** Accepts { buffer, contentType } or { dataUrl } from any provider. */
function toBuffer(result) {
  if (result?.buffer) {
    return { buffer: Buffer.from(result.buffer), contentType: result.contentType || "image/png" };
  }
  const dataUrl = result?.dataUrl || "";
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Image provider returned no usable image data");
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] };
}

/** @returns {{url: string, key: string, provider: string, fallback: boolean}} */
async function saveImage(buffer, contentType, taskId, tag = "") {
  const ext = EXT[contentType] || "png";
  const name = `task-${taskId || "adhoc"}${tag ? `-${tag}` : ""}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return uploadImage(buffer, contentType, name);
}

/** Saves a manually uploaded image (used when AI generation fails or a reviewer wants to swap the image). */
export async function saveUploadedImage(buffer, contentType, taskId) {
  const ext = EXT[contentType];
  if (!ext) throw new Error("Unsupported image type. Use PNG, JPEG or WebP.");
  const name = `task-${taskId || "adhoc"}-upload-${Date.now()}.${ext}`;
  return uploadImage(buffer, contentType, name);
}

async function log(ctx, kb, { provider, model, status, duration = 0, error = null, prompt, output = null }) {
  await logAgentExecution({
    tenant_id: ctx.tenantId || null,
    task_id: ctx.taskId || null,
    client_id: kb.client_id,
    agent: "image",
    provider,
    model,
    duration_ms: duration,
    status,
    attempt: 1,
    error,
    prompt_preview: String(prompt).slice(0, 600),
    output_preview: output,
  });
}

export function placeholder(kb, topic) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect x="60" y="60" width="1080" height="780" fill="none" stroke="#ffffff33" stroke-width="2" stroke-dasharray="12 10"/>
  <text x="600" y="380" font-family="Segoe UI,Arial" font-size="54" fill="#ffffff" text-anchor="middle">${esc(kb.business)}</text>
  <text x="600" y="460" font-family="Segoe UI,Arial" font-size="38" fill="#c7d2fe" text-anchor="middle">${esc(topic)}</text>
  <text x="600" y="530" font-family="Segoe UI,Arial" font-size="28" fill="#a5b4fc" text-anchor="middle">${esc(kb.city || "")}</text>
  <text x="600" y="800" font-family="Segoe UI,Arial" font-size="24" fill="#e2e8f0" text-anchor="middle">IMAGE PLACEHOLDER - see AI execution log for the reason</text>
</svg>`;
  return {
    url: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    provider: "placeholder",
    placeholder: true,
    // Deterministic (same business+topic -> same SVG) - flag this too, so a repeated
    // topic doesn't also ship the exact same placeholder image two days running.
    contentHash: crypto.createHash("sha256").update(svg).digest("hex"),
  };
}

function esc(s) {
  return String(s || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
}
/**
 * Plain AI photo (no logo / title / CTA overlay) - used for website sections
 * (hero, about, each service). Returns { url } or null when no image provider
 * is configured / all fail. Charged like any AI image.
 */
export async function generatePhoto(kb, { subject, scene = null, tag = "web" }, ctx = {}) {
  const candidates = imageCandidateProviders();
  if (!candidates.length) return null;
  const prompt = [
    scene || `A realistic professional photograph for the website of ${kb.business}, a ${kb.category} in ${kb.city}`,
    `Subject: ${subject}`,
    `Authentic Indian ${String(kb.category || "business").toLowerCase()} setting in ${kb.city}, real people where natural, bright natural light, 35mm commercial photography, true-to-life colours`,
    "Landscape 16:9 composition, single full-bleed photo",
    "No text, letters, numbers, logos, watermarks, signage, brand names, phone numbers or website addresses. Fully clothed people, no gore.",
  ].join(". ");
  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i];
    const started = Date.now();
    try {
      const result = await provider.image(prompt);
      const { buffer, contentType } = toBuffer(result);
      const stored = await saveImage(buffer, contentType, null, `${tag}-c${kb.client_id}`);
      await chargeAgent({ agent: "image", clientId: kb.client_id, tenantId: ctx.tenantId || null, taskId: null });
      await log(ctx, kb, { provider: `${provider.name}:${result.endpoint || "inference"}`, model: result.model || provider.imageModel, status: i > 0 ? "FALLBACK" : "SUCCESS", duration: Date.now() - started, prompt, output: `${stored.url} (website ${tag})` });
      return { url: stored.url, provider: provider.name };
    } catch (err) {
      await log(ctx, kb, { provider: provider.name, model: provider.imageModel, status: "FAILED", duration: Date.now() - started, prompt, error: err.message });
    }
  }
  return null;
}

/** True when at least one real AI image provider is set up. */
export function aiImagesAvailable() {
  return imageCandidateProviders().length > 0;
}

/**
 * Admin preview of an image style for a real client - no credits, no task.
 * Returns { buffer, contentType, prompt, provider }.
 */
export async function previewStyleImage(kb, style, sample = {}) {
  const client = await one("SELECT brand_color, logo_url, business_name, city FROM clients WHERE id=?", [kb.client_id]).catch(() => null);
  const input = {
    topic: sample.topic || `${kb.services?.[0] || kb.category} in ${kb.city || ""}`.trim(),
    service: kb.services?.[0] || kb.category,
    concept: sample.concept || null,
    title: sample.title || `${kb.services?.[0] || kb.category} in ${kb.city || "your area"}`,
    subtitle: sample.subtitle || `Trusted ${String(kb.category || "").toLowerCase()} in ${kb.city || "your city"}`,
    cta: sample.cta || "Call now",
  };
  const showButton = await imageButtonEnabled();
  const prompt = renderStyle(showButton ? style.prompt || "" : withoutButton(style.prompt || ""), styleVars(kb, input, client?.brand_color));
  const candidates = imageCandidateProviders();
  let buffer = null;
  let contentType = "image/png";
  let provider = "none";
  if (candidates.length) {
    let lastErr = null;
    for (const p of candidates) {
      try {
        const r = await p.image(prompt, { aspectRatio: style.aspect || "4:3" });
        ({ buffer, contentType } = toBuffer(r));
        provider = `${p.name}:${r.model || p.imageModel}`;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!buffer && style.mode !== "BRANDED_PHOTO") throw Object.assign(new Error(`Image provider failed: ${String(lastErr?.message || "").slice(0, 200)}`), { status: 502 });
  } else if (style.mode !== "BRANDED_PHOTO") {
    throw Object.assign(new Error("No image-capable AI provider is configured (Gemini / OpenAI / Hugging Face)."), { status: 400 });
  }
  const logo = await toDataUrl(client?.logo_url);
  if (style.mode === "BRANDED_PHOTO") {
    const png = await renderCreative({
      photo: buffer, photoType: contentType, logo,
      business: client?.business_name || kb.business, city: client?.city || kb.city,
      title: fitText(input.title, IMAGE_TITLE_MAX_CHARS), subtitle: fitText(input.subtitle, 60), cta: showButton ? fitText(input.cta, 22) : null,
      brand: /^#[0-9a-f]{6}$/i.test(client?.brand_color || "") ? client.brand_color : "#0B2A5B",
    });
    return { buffer: png, contentType: "image/png", prompt, provider: `branded+${provider}` };
  }
  if (style.overlay === "LOGO") {
    const withLogo = await renderLogoOverlay({ photo: buffer, photoType: contentType, logo, business: client?.business_name }).catch(() => null);
    if (withLogo) return { buffer: withLogo, contentType: "image/png", prompt, provider };
  }
  return { buffer, contentType, prompt, provider };
}

/** Stores an admin preview so workspaces see a thumbnail of the style. */
export async function storeStylePreview(buffer, contentType, styleId) {
  const ext = EXT[contentType] || "png";
  return uploadImage(buffer, contentType, `style-${styleId}-${Date.now()}.${ext}`);
}
