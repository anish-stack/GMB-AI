import "server-only";
import { OpenAIProvider } from "./providers/openai.js";
import { HuggingFaceProvider } from "./providers/huggingface.js";
import { OllamaProvider } from "./providers/ollama.js";
import { GeminiProvider } from "./providers/gemini.js";
import { MockProvider } from "./providers/mock.js";
import { estimateCost, estimateTokens } from "./cost.js";
import { insert } from "../db.js";
import { tenantOfClient } from "../saas/resolve.js";
import { tryConsume, creditCostFor } from "../saas/credits.js";
import { incrementUsage } from "../saas/usage.js";
import { METRICS } from "../saas/constants.js";

/**
 * Provider chain, tried in order until one succeeds:
 *   1. Ollama       - free, local text+embeddings, only when OLLAMA_ENABLED=true (dev
 *                     machine). No image support, so it's skipped automatically for
 *                     image generation and Gemini is tried first for images instead.
 *   2. Gemini       - paid, tried right after Ollama for text, and FIRST for images
 *                     (text+image capable). This is what everything falls back to
 *                     when Ollama is off/unreachable.
 *   3. OpenAI       - paid fallback if Gemini fails or isn't configured
 *   4. Hugging Face - paid fallback if OpenAI fails or isn't configured
 *   5. Mock         - deterministic offline generator, last resort, never fails
 *
 * Because Ollama has no image() method, ImageService's provider filter drops it
 * automatically - so the *effective image chain* is Gemini -> OpenAI -> Hugging Face,
 * while the *text chain* is Ollama -> Gemini -> OpenAI -> Hugging Face.
 *
 * Set AI_PROVIDER=ollama, AI_PROVIDER=gemini, AI_PROVIDER=huggingface or
 * AI_PROVIDER=mock in .env to force a single provider instead of the chain
 * above (useful for testing).
 */
let cachedChain = null;

function buildChain() {
  const want = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const mock = new MockProvider();

  if (want === "mock") return [mock];

  if (want === "ollama") {
    const ollama = new OllamaProvider();
    return ollama.isConfigured() ? [ollama, mock] : [mock];
  }

  if (want === "gemini") {
    const gemini = new GeminiProvider();
    return gemini.isConfigured() ? [gemini, mock] : [mock];
  }

  if (want === "huggingface") {
    const hf = new HuggingFaceProvider();
    return hf.isConfigured() ? [hf, mock] : [mock];
  }

  // Default ("openai"): local Ollama first if enabled (free, text-only), then Gemini
  // (text + image), then OpenAI, then Hugging Face, then Mock.
  const ollama = new OllamaProvider();
  const gemini = new GeminiProvider();
  const openai = new OpenAIProvider();
  const hf = new HuggingFaceProvider();
  const chain = [];
  if (ollama.isConfigured()) chain.push(ollama);
  if (gemini.isConfigured()) chain.push(gemini);
  if (openai.isConfigured()) chain.push(openai);
  if (hf.isConfigured()) chain.push(hf);
  chain.push(mock);
  return chain;
}

export function getProviderChain() {
  if (!cachedChain) cachedChain = buildChain();
  return cachedChain;
}

/** Primary provider (first in the chain). */
export function getProvider() {
  return getProviderChain()[0];
}

/** Force-refresh the provider chain (used after settings change in dev) */
export function resetProvider() {
  cachedChain = null;
}

export function providerInfo() {
  const chain = getProviderChain();
  const p = chain[0];
  return {
    name: p.name,
    textModel: p.textModel,
    embeddingModel: p.embeddingModel,
    imageModel: p.imageModel || null,
    configured: p.isConfigured(),
    fallbackChain: chain.map((c) => c.name),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function extractJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

async function logExecution(row) {
  try {
    const tenantId = row.tenant_id ?? (await tenantOfClient(row.client_id));
    await insert("ai_executions", { ...row, tenant_id: tenantId || null });
    if (tenantId) await incrementUsage(tenantId, METRICS.AI_CALLS, 1);
  } catch (e) {
    console.error("ai_executions log failed:", e.message);
  }
}

/**
 * Debits the tenant wallet for one AI unit. Failed calls are never charged.
 * Never throws - the orchestrator pre-checks the balance before a run starts.
 */
export async function chargeAgent({ agent, clientId, tenantId = null, taskId = null }) {
  const tid = tenantId || (await tenantOfClient(clientId));
  if (!tid) return 0;
  const cost = await creditCostFor(agent);
  if (!cost) return 0;
  const charged = await tryConsume(tid, cost, {
    reason: agent === "image" ? "AI_IMAGE" : "AI_TEXT",
    refType: "task",
    refId: taskId,
    note: agent,
  });
  if (charged) {
    await incrementUsage(tid, METRICS.CREDITS, charged);
    if (agent === "image") await incrementUsage(tid, METRICS.IMAGES, 1);
  }
  return charged;
}

/** Public logger so non-text agents (image, embedding) also appear in the run log. */
export async function logAgentExecution(row) {
  return logExecution(row);
}

/**
 * Central AI entry point. Every agent goes through this - no direct provider
 * calls anywhere else in the app.
 *
 * Walks the provider chain (OpenAI -> Hugging Face -> Mock by default): each
 * provider gets AI_MAX_RETRIES retries before moving on to the next provider.
 */
export async function runAI({
  agent,
  system,
  prompt,
  meta = {},
  taskId = null,
  clientId = null,
  maxTokens = 900,
  temperature = 0.7,
  json = true,
}) {
  const maxRetries = Number(process.env.AI_MAX_RETRIES || 2);
  const chain = getProviderChain();
  let lastError = null;

  for (let p = 0; p < chain.length; p++) {
    const provider = chain[p];

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const started = Date.now();
      try {
        const res = await provider.complete({ system, prompt, meta, maxTokens, temperature, json });
        const duration = Date.now() - started;
        const inputTokens = res.inputTokens ?? estimateTokens(`${system || ""}${prompt || ""}`);
        const outputTokens = res.outputTokens ?? estimateTokens(res.text);
        const credits = await chargeAgent({ agent, clientId, taskId });
        await logExecution({
          credits_charged: credits,
          task_id: taskId,
          client_id: clientId,
          agent,
          provider: provider.name,
          model: res.model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost: estimateCost({ inputTokens, outputTokens }),
          duration_ms: duration,
          status: p > 0 ? "FALLBACK" : "SUCCESS",
          attempt,
          prompt_preview: String(prompt || "").slice(0, 1200),
          output_preview: String(res.text || "").slice(0, 4000),
        });
        return {
          raw: res.text,
          data: json ? extractJson(res.text) : res.text,
          provider: provider.name,
          model: res.model,
        };
      } catch (err) {
        lastError = err;
        await logExecution({
          task_id: taskId,
          client_id: clientId,
          agent,
          provider: provider.name,
          model: provider.textModel,
          duration_ms: Date.now() - started,
          status: "FAILED",
          attempt,
          error: String(err.message).slice(0, 1000),
          prompt_preview: String(prompt || "").slice(0, 1200),
        });
        if (attempt <= maxRetries) {
          await sleep(500 * attempt);
          continue;
        }
        // Retries exhausted for this provider - fall through to the next one in the chain.
      }
    }
  }
  throw new Error(`AI agent "${agent}" failed on every provider: ${lastError ? lastError.message : "unknown"}`);
}

export async function embed(text, { taskId = null, clientId = null } = {}) {
  const chain = getProviderChain();
  let lastError = null;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const started = Date.now();
    try {
      const vec = await provider.embed(text);
      const credits = await chargeAgent({ agent: "embedding", clientId, taskId });
      await logExecution({
        credits_charged: credits,
        task_id: taskId,
        client_id: clientId,
        agent: "embedding",
        provider: provider.name,
        model: provider.embeddingModel,
        duration_ms: Date.now() - started,
        status: i > 0 ? "FALLBACK" : "SUCCESS",
        attempt: 1,
      });
      return vec;
    } catch (err) {
      lastError = err;
      await logExecution({
        task_id: taskId,
        client_id: clientId,
        agent: "embedding",
        provider: provider.name,
        model: provider.embeddingModel,
        duration_ms: Date.now() - started,
        status: "FAILED",
        attempt: 1,
        error: String(err.message).slice(0, 500),
      });
      // Mock's embed() never throws, so this loop always terminates successfully by the end.
    }
  }
  throw new Error(`Embedding failed on every provider: ${lastError ? lastError.message : "unknown"}`);
}
