import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { getProvider, logAgentExecution, chargeAgent } from "../ai/index.js";
import * as imagePrompt from "../ai/prompts/image.js";

/**
 * ImageService - provider-agnostic, never throws.
 *
 * Generated images are written to disk (storage/images) and only a short URL
 * is stored in the database. A 1.2 MB JPEG becomes a ~1.7 MB base64 string,
 * which is larger than MySQL's default max_allowed_packet (1 MB in XAMPP) and
 * kills the connection with "write ECONNRESET" mid-pipeline.
 *
 * Files are served by /api/media/[file].
 * Only the small SVG placeholder stays inline as a data URL.
 *
 * Every attempt is logged to ai_executions as agent "image".
 */
const STORAGE_DIR = process.env.IMAGE_STORAGE_DIR || path.join(process.cwd(), "storage", "images");

const EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export async function generateImage(kb, { topic, service, concept }, ctx = {}) {
  const prompt = imagePrompt.build(kb, { topic, service, concept });
  const provider = getProvider();
  const canGenerate =
    ctx.imagesEnabled !== false &&
    typeof provider.image === "function" && provider.name !== "mock" && Boolean(process.env.HF_IMAGE_MODEL);

  if (!canGenerate) {
    const reason =
      ctx.imagesEnabled === false
        ? "AI image generation is not included in this plan"
        : provider.name === "mock"
        ? "AI provider is the local fallback (no HF_API_KEY)"
        : "HF_IMAGE_MODEL is not set in .env";
    await log(ctx, kb, { provider: provider.name, model: process.env.HF_IMAGE_MODEL || "none", status: "SKIPPED", error: reason, prompt });
    return { ...placeholder(kb, topic), prompt, note: `Image generation skipped: ${reason}` };
  }

  const started = Date.now();
  try {
    const result = await provider.image(prompt);
    const { buffer, contentType } = toBuffer(result);
    const url = await saveImage(buffer, contentType, ctx.taskId);
    await chargeAgent({ agent: "image", clientId: kb.client_id, tenantId: ctx.tenantId || null, taskId: ctx.taskId || null });

    await log(ctx, kb, {
      provider: `${provider.name}:${result.endpoint || "inference"}`,
      model: result.model || process.env.HF_IMAGE_MODEL,
      status: "SUCCESS",
      duration: Date.now() - started,
      prompt,
      output: `${url} (${Math.round(buffer.length / 1024)} KB ${contentType})`,
    });

    return {
      url,
      provider: `${provider.name}:${result.model || process.env.HF_IMAGE_MODEL}`,
      prompt,
      placeholder: false,
      note: null,
      bytes: buffer.length,
    };
  } catch (err) {
    await log(ctx, kb, {
      provider: provider.name,
      model: process.env.HF_IMAGE_MODEL,
      status: "FAILED",
      duration: Date.now() - started,
      error: String(err.message).slice(0, 900),
      prompt,
    });
    return { ...placeholder(kb, topic), prompt, note: `Image failed: ${String(err.message).slice(0, 200)}` };
  }
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

async function saveImage(buffer, contentType, taskId) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const ext = EXT[contentType] || "png";
  const name = `task-${taskId || "adhoc"}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(STORAGE_DIR, name), buffer);
  return `/api/media/${name}`;
}

/** Saves a manually uploaded image (used when AI generation fails or a reviewer wants to swap the image). */
export async function saveUploadedImage(buffer, contentType, taskId) {
  const ext = EXT[contentType];
  if (!ext) throw new Error("Unsupported image type. Use PNG, JPEG or WebP.");
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const name = `task-${taskId || "adhoc"}-upload-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(STORAGE_DIR, name), buffer);
  return `/api/media/${name}`;
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
