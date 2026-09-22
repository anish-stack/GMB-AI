import "server-only";
import { getProviderChain, logAgentExecution, chargeAgent } from "../ai/index.js";
import { uploadImage } from "../storage/index.js";
import * as imagePrompt from "../ai/prompts/image.js";

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

function imageCandidateProviders() {
  return getProviderChain().filter(
    (p) => typeof p.image === "function" && p.name !== "mock" && p.isConfigured() && hasImageModel(p)
  );
}

/** Generates ONE image and returns it - the original single-image entry point. */
export async function generateImage(kb, { topic, service, concept }, ctx = {}) {
  const prompt = imagePrompt.build(kb, { topic, service, concept });

  if (ctx.imagesEnabled === false) {
    const reason = "AI image generation is not included in this plan";
    await log(ctx, kb, { provider: "none", model: "none", status: "SKIPPED", error: reason, prompt });
    return { ...placeholder(kb, topic), prompt, note: `Image generation skipped: ${reason}` };
  }

  // Try each image-capable provider in order (Gemini -> OpenAI -> Hugging Face by
  // default - Ollama has no image() method so it's filtered out automatically).
  const candidates = imageCandidateProviders();

  if (!candidates.length) {
    const reason = "No image-capable AI provider is configured (set GEMINI_API_KEY, OPENAI_API_KEY, or HF_API_KEY + HF_IMAGE_MODEL)";
    await log(ctx, kb, { provider: "none", model: "none", status: "SKIPPED", error: reason, prompt });
    return { ...placeholder(kb, topic), prompt, note: `Image generation skipped: ${reason}` };
  }

  let lastError = null;
  for (let i = 0; i < candidates.length; i++) {
    const provider = candidates[i];
    const started = Date.now();
    try {
      const result = await provider.image(prompt);
      const { buffer, contentType } = toBuffer(result);
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
        provider: `${provider.name}:${result.model || provider.imageModel}`,
        storageProvider: stored.provider,
        storageKey: stored.key,
        prompt,
        placeholder: false,
        note: null,
        bytes: buffer.length,
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
export async function generateImageOptions(kb, { topic, service, concept }, ctx = {}, count = 3) {
  const n = Math.max(1, Math.min(Number(count) || 1, 6));
  const results = await Promise.all(
    Array.from({ length: n }, (_, i) => generateImage(kb, { topic, service, concept }, { ...ctx, tag: `opt${i + 1}` }))
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
  };
}

function esc(s) {
  return String(s || "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
}
