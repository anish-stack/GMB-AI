import "server-only";
import { HuggingFaceProvider } from "./providers/huggingface.js";
import { MockProvider } from "./providers/mock.js";
import { estimateCost, estimateTokens } from "./cost.js";
import { insert } from "../db.js";

let cached = null;

export function getProvider() {
  if (cached) return cached;
  const want = (process.env.AI_PROVIDER || "huggingface").toLowerCase();
  if (want === "huggingface") {
    const hf = new HuggingFaceProvider();
    cached = hf.isConfigured() ? hf : new MockProvider();
  } else {
    cached = new MockProvider();
  }
  return cached;
}

/** Force-refresh provider (used after settings change in dev) */
export function resetProvider() {
  cached = null;
}

export function providerInfo() {
  const p = getProvider();
  return {
    name: p.name,
    textModel: p.textModel,
    embeddingModel: p.embeddingModel,
    imageModel: p.imageModel || null,
    configured: p.isConfigured(),
  };
}

const fallbackProvider = new MockProvider();
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
    await insert("ai_executions", row);
  } catch (e) {
    console.error("ai_executions log failed:", e.message);
  }
}

/** Public logger so non-text agents (image, embedding) also appear in the run log. */
export async function logAgentExecution(row) {
  return logExecution(row);
}

/**
 * Central AI entry point. Every agent goes through this - no direct
 * Hugging Face calls anywhere else in the app.
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
  let provider = getProvider();
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const started = Date.now();
    try {
      const res = await provider.complete({ system, prompt, meta, maxTokens, temperature, json });
      const duration = Date.now() - started;
      const inputTokens = res.inputTokens ?? estimateTokens(`${system || ""}${prompt || ""}`);
      const outputTokens = res.outputTokens ?? estimateTokens(res.text);
      await logExecution({
        task_id: taskId,
        client_id: clientId,
        agent,
        provider: provider.name,
        model: res.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost: estimateCost({ inputTokens, outputTokens }),
        duration_ms: duration,
        status: provider.name === "mock" && getProvider().name !== "mock" ? "FALLBACK" : "SUCCESS",
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
      // Last resort: deterministic local provider so the task is never lost
      if (provider.name !== "mock") {
        provider = fallbackProvider;
        attempt = maxRetries; // one more loop with the fallback
        continue;
      }
    }
  }
  throw new Error(`AI agent "${agent}" failed: ${lastError ? lastError.message : "unknown"}`);
}

export async function embed(text, { taskId = null, clientId = null } = {}) {
  const provider = getProvider();
  const started = Date.now();
  try {
    const vec = await provider.embed(text);
    await logExecution({
      task_id: taskId,
      client_id: clientId,
      agent: "embedding",
      provider: provider.name,
      model: provider.embeddingModel,
      duration_ms: Date.now() - started,
      status: "SUCCESS",
      attempt: 1,
    });
    return vec;
  } catch (err) {
    const vec = await fallbackProvider.embed(text);
    await logExecution({
      task_id: taskId,
      client_id: clientId,
      agent: "embedding",
      provider: "mock",
      model: fallbackProvider.embeddingModel,
      duration_ms: Date.now() - started,
      status: "FALLBACK",
      attempt: 1,
      error: String(err.message).slice(0, 500),
    });
    return vec;
  }
}
