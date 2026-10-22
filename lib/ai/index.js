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
import { applyPromptOverrides } from "./promptStore.js";
import { enginePreferred } from "./engine.js";

/**
 * Provider chains (v11.2)
 *
 *   TEXT + embeddings:  Ollama (free, local) -> Gemini -> [OpenAI -> Hugging Face] -> Mock
 *                       Ollama is used only while it is enabled AND reachable; when it is
 *                       off, down or times out, every agent goes to Gemini automatically.
 *   IMAGES:             Gemini only (IMAGE_PROVIDER=gemini, default). IMAGE_PROVIDER=auto
 *                       restores the old Gemini -> OpenAI -> Hugging Face image fallback.
 *
 * AI_PROVIDER:
 *   auto (default)  Ollama -> Gemini -> OpenAI -> HF -> Mock
 *   ollama          Ollama -> Gemini -> Mock          (Gemini is the safety net)
 *   gemini          Gemini -> Mock                    (skip Ollama)
 *   openai | huggingface | mock   force that provider (testing)
 *
 * The chain is rebuilt automatically when the relevant env changes (Admin ->
 * Integrations writes env at runtime), so no restart is needed after a key change.
 */
let cachedChain = null;
let cachedSig = "";

const CHAIN_ENV = [
  "AI_PROVIDER", "IMAGE_PROVIDER",
  "OLLAMA_ENABLED", "OLLAMA_BASE_URL", "OLLAMA_TEXT_MODEL", "OLLAMA_EMBEDDING_MODEL", "OLLAMA_API_KEY",
  "GEMINI_API_KEY", "GEMINI_TEXT_MODEL", "GEMINI_IMAGE_MODEL", "GEMINI_EMBEDDING_MODEL",
  "OPENAI_API_KEY", "HF_API_KEY", "HF_IMAGE_MODEL",
];
const envSig = () => CHAIN_ENV.map((k) => `${k}=${process.env[k] || ""}`).join("|");

function buildChain() {
  const want = (process.env.AI_PROVIDER || "auto").toLowerCase();
  const mock = new MockProvider();
  const ollama = new OllamaProvider();
  const gemini = new GeminiProvider();
  const openai = new OpenAIProvider();
  const hf = new HuggingFaceProvider();
  const on = (p) => (p.isConfigured() ? [p] : []);

  if (want === "mock") return [mock];
  if (want === "ollama") return [...on(ollama), ...on(gemini), mock];
  if (want === "gemini") return [...on(gemini), mock];
  if (want === "openai") return [...on(openai), mock];
  if (want === "huggingface") return [...on(hf), mock];
  // auto
  return [...on(ollama), ...on(gemini), ...on(openai), ...on(hf), mock];
}

export function getProviderChain() {
  const sig = envSig();
  if (!cachedChain || sig !== cachedSig) {
    cachedChain = buildChain();
    cachedSig = sig;
  }
  return cachedChain;
}

/** Moves the named provider to the front (if present). */
function preferFirst(chain, name) {
  if (!name) return chain;
  const hit = chain.find((p) => p.name === name);
  return hit ? [hit, ...chain.filter((p) => p !== hit)] : chain;
}

/** True when a real (non-template) AI provider is set up. */
export function hasRealTextProvider() {
  return getProviderChain().some((p) => p.name !== "mock");
}

/** Text chain with providers that are currently unreachable (Ollama down) left out. */
export async function getLiveTextChain() {
  const chain = getProviderChain();
  const out = [];
  for (const p of chain) {
    if (typeof p.available === "function" && !(await p.available())) continue;
    out.push(p);
  }
  return out.length ? out : chain.slice(-1);
}

/**
 * Image chain: Gemini only by default. IMAGE_PROVIDER=auto -> every image-capable
 * provider (Gemini -> OpenAI -> Hugging Face). Never Ollama, never Mock.
 */
export function getImageChain() {
  const mode = (process.env.IMAGE_PROVIDER || "gemini").toLowerCase();
  const gemini = getProviderChain().find((p) => p.name === "gemini") || new GeminiProvider();
  if (mode !== "auto") {
    if (mode === "gemini") return gemini.isConfigured() ? [gemini] : [];
    const forced = mode === "openai" ? new OpenAIProvider() : mode === "huggingface" ? new HuggingFaceProvider() : null;
    return forced?.isConfigured() ? [forced] : [];
  }
  const all = [gemini, new OpenAIProvider(), new HuggingFaceProvider()];
  return all.filter((p) => p.isConfigured());
}

/** Primary provider (first in the chain). */
export function getProvider() {
  return getProviderChain()[0];
}

/** Force-refresh the provider chain (used after settings change in dev) */
export function resetProvider() {
  cachedChain = null;
  cachedSig = "";
}

export function providerInfo() {
  const chain = getProviderChain();
  const p = chain[0];
  return {
    name: p.name,
    textModel: p.textModel,
    embeddingModel: p.embeddingModel,
    imageModel: getImageChain()[0]?.imageModel || null,
    imageProvider: getImageChain()[0]?.name || null,
    configured: p.isConfigured(),
    fallbackChain: chain.map((c) => c.name),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function extractJson(text) {
  const v = extractJsonRaw(text);
  // Unwrap a stringified object inside a single key, e.g. {"reply":"{\"title\":...}"}
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const keys = Object.keys(v);
    if (keys.length === 1 && typeof v[keys[0]] === "string" && v[keys[0]].trim().startsWith("{")) {
      const inner = extractJsonRaw(v[keys[0]]);
      if (inner && typeof inner === "object") return inner;
    }
  }
  return v;
}

function extractJsonRaw(text) {
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
/** Verbose AI tracing only when AI_DEBUG=1 - keeps prod logs (and customer text) clean. */
function aiDebug(...args) {
  if (process.env.AI_DEBUG === "1") console.log(...args);
}

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
  schema = null,
  exclude = [], // provider names to skip for this call, e.g. ["ollama"]
}) {
  // admin-edited prompts (Admin -> AI prompts)
  ({ system, prompt } = await applyPromptOverrides(agent, system, prompt));
  const maxRetries = Number(process.env.AI_MAX_RETRIES || 2);
  const live = await getLiveTextChain();
  // manual run with "Gemini" picked -> skip Ollama for every agent of that run
  const filtered = exclude.length ? live.filter((p) => !exclude.includes(p.name)) : live;
  // engine choice (Gemini / Hybrid) = try that provider first, keep the others as fallback
  const chain = preferFirst(filtered, enginePreferred(agent));
  const failures = new Map(); // provider -> last error (shown when we had to fall back)
  if (!chain.length) throw new Error(`AI agent "${agent}": no provider left after excluding ${exclude.join(", ")}`);
  let lastError = null;

  aiDebug("[AI] runAI started", {
    agent,
    taskId,
    clientId,
    maxTokens,
    temperature,
    json,
    providers: chain.map((p) => p.name),
    maxRetries,
  });

  for (let p = 0; p < chain.length; p++) {
    const provider = chain[p];

    aiDebug("[AI] Provider selected", {
      index: p,
      provider: provider.name,
      model: provider.textModel,
      isFallback: p > 0,
    });

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const started = Date.now();

      aiDebug("[AI] Request attempt started", {
        agent,
        provider: provider.name,
        model: provider.textModel,
        attempt,
        maxAttempts: maxRetries + 1,
        taskId,
        clientId,
        promptLength: String(prompt || "").length,
        systemLength: String(system || "").length,
      });

      try {
        const res = await provider.complete({
          system,
          prompt,
          meta,
          maxTokens,
          temperature,
          json,
          schema,
        });

        const duration = Date.now() - started;

        const inputTokens =
          res.inputTokens ??
          estimateTokens(`${system || ""}${prompt || ""}`);

        const outputTokens =
          res.outputTokens ??
          estimateTokens(res.text);

        aiDebug("[AI] Provider response received", {
          provider: provider.name,
          model: res.model,
          attempt,
          duration_ms: duration,
          inputTokens,
          outputTokens,
          outputLength: String(res.text || "").length,
        });

        const credits = await chargeAgent({
          agent,
          clientId,
          taskId,
        });

        aiDebug("[AI] Credits charged", {
          agent,
          clientId,
          taskId,
          credits,
        });

        await logExecution({
          credits_charged: credits,
          task_id: taskId,
          client_id: clientId,
          agent,
          provider: provider.name,
          model: res.model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost: estimateCost({
            inputTokens,
            outputTokens,
          }),
          duration_ms: duration,
          status: p > 0 ? "FALLBACK" : "SUCCESS",
          attempt,
          prompt_preview: String(prompt || "").slice(0, 1200),
          output_preview: String(res.text || "").slice(0, 4000),
        });

        aiDebug("[AI] runAI success", {
          agent,
          provider: provider.name,
          model: res.model,
          status: p > 0 ? "FALLBACK" : "SUCCESS",
          attempt,
          duration_ms: duration,
        });

        return {
          raw: res.text,
          data: json ? extractJson(res.text) : res.text,
          provider: provider.name,
          model: res.model,
          // why the earlier providers were skipped (e.g. Gemini quota / bad model name)
          fallbackReason: p > 0 && failures.size ? [...failures].map(([n, m]) => `${n}: ${m}`).join(" | ").slice(0, 400) : null,
        };
      } catch (err) {
        lastError = err;
        failures.set(provider.name, String(err?.message || err).slice(0, 180));

        const duration = Date.now() - started;

        console.error("[AI] Request failed", {
          agent,
          provider: provider.name,
          model: provider.textModel,
          attempt,
          duration_ms: duration,
          error: err?.message,
          stack: err?.stack,
        });

        await logExecution({
          task_id: taskId,
          client_id: clientId,
          agent,
          provider: provider.name,
          model: provider.textModel,
          duration_ms: duration,
          status: "FAILED",
          attempt,
          error: String(err.message).slice(0, 1000),
          prompt_preview: String(prompt || "").slice(0, 1200),
        });

        // Ollama connection problems / timeouts: don't retry, go to Gemini now
        if (provider.noRetry && /falling back/.test(String(err?.message))) break;

        if (attempt <= maxRetries) {
          const delay = 500 * attempt;

          console.warn("[AI] Retrying provider", {
            provider: provider.name,
            nextAttempt: attempt + 1,
            delay_ms: delay,
          });

          await sleep(delay);
          continue;
        }

        console.warn("[AI] Provider retries exhausted", {
          provider: provider.name,
          attempts: maxRetries + 1,
          hasNextProvider: p < chain.length - 1,
        });

        // Retries exhausted for this provider -
        // move to next provider.
      }
    }
  }

  console.error("[AI] All providers failed", {
    agent,
    taskId,
    clientId,
    lastError: lastError?.message,
  });

  throw new Error(
    `AI agent "${agent}" failed on every provider: ${
      lastError ? lastError.message : "unknown"
    }`,
  );
}
export async function embed(text, { taskId = null, clientId = null } = {}) {
  const chain = preferFirst(await getLiveTextChain(), enginePreferred("embedding"));
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