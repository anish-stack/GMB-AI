/**
 * Ollama provider - free, local text + embeddings. First in the text chain when
 * enabled; Gemini takes over automatically whenever Ollama is off, down or slow.
 * No image generation (Ollama runs LLMs, not image models) - images use Gemini.
 *
 *   ollama pull llama3.2            (or qwen2.5:7b)
 *   ollama pull nomic-embed-text
 *
 * Enable with OLLAMA_ENABLED=true (or Admin -> Integrations -> Ollama).
 *
 * Availability: a quick ping (GET /api/tags, 2 s) is cached for 30 s. When Ollama
 * can't be reached it is marked down for 60 s, so every agent goes straight to
 * Gemini instead of waiting on retries.
 */
const PING_TTL_MS = 30_000;
const DOWN_FOR_MS = 60_000;
const state = { checkedAt: 0, up: false, downUntil: 0 };

function truthy(v) {
  return ["1", "true", "yes", "on"].includes(String(v || "").trim().toLowerCase());
}

/** Accepts http://host:11434, http://host:11434/ or http://host:11434/v1 */
function apiBase(url) {
  const u = String(url || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  return /\/v1$/.test(u) ? u : `${u}/v1`;
}

export class OllamaProvider {
  constructor() {
    this.name = "ollama";
    this.enabled = truthy(process.env.OLLAMA_ENABLED);
    this.baseUrl = apiBase(process.env.OLLAMA_BASE_URL);
    this.rootUrl = this.baseUrl.replace(/\/v1$/, "");
    this.apiKey = process.env.OLLAMA_API_KEY || ""; // only needed behind an auth proxy
    this.textModel = process.env.OLLAMA_TEXT_MODEL || "llama3.2";
    this.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
    this.imageModel = null; // no image generation support
    // CPU models are slow - give them more time than the cloud APIs
    this.timeout = Number(process.env.OLLAMA_TIMEOUT_MS || Math.max(Number(process.env.AI_TIMEOUT_MS || 0), 180000));
    this.numCtx = Number(process.env.OLLAMA_NUM_CTX || 8192); // prompts carry the business knowledge - 2k default is too small
    this.noRetry = true; // connection problems -> straight to the next provider
  }

  isConfigured() {
    return this.enabled;
  }

  /** Marks Ollama unreachable for a minute (called after connection errors / timeouts). */
  markDown() {
    state.up = false;
    state.checkedAt = Date.now();
    state.downUntil = Date.now() + DOWN_FOR_MS;
  }

  /** Fast reachability check, cached. */
  async available() {
    if (!this.enabled) return false;
    const now = Date.now();
    if (now < state.downUntil) return false;
    if (now - state.checkedAt < PING_TTL_MS) return state.up;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${this.rootUrl}/api/tags`, {
        signal: controller.signal,
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      state.up = res.ok;
    } catch {
      state.up = false;
    } finally {
      clearTimeout(timer);
    }
    state.checkedAt = Date.now();
    if (!state.up) state.downUntil = Date.now() + DOWN_FOR_MS;
    return state.up;
  }

  async #post(path, body, { timeout = this.timeout, root = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${root ? this.rootUrl : this.baseUrl}${path}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (err) {
      if (err?.name === "AbortError") {
        this.markDown();
        throw new Error(`Ollama timeout after ${timeout} ms - falling back`);
      }
      const code = err?.cause?.code || err?.code;
      if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EHOSTUNREACH" || /fetch failed/i.test(String(err?.message))) {
        this.markDown();
        throw new Error(`Could not reach Ollama at ${this.rootUrl} - falling back`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async complete({ system, prompt, maxTokens = 600, temperature = 0.7, json = true }) {
    if (!this.isConfigured()) throw new Error("Ollama is not enabled");
    if (!prompt) throw new Error("Prompt is required");

    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    // native /api/chat so we can raise the context window (OpenAI-compatible
    // endpoint is stuck at Ollama's small default and silently cuts long prompts)
    const data = await this.#post(
      "/api/chat",
      {
        model: this.textModel,
        messages,
        stream: false,
        ...(json ? { format: "json" } : {}),
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || "24h",
        options: { temperature, num_predict: Math.max(Number(maxTokens) || 600, 256), num_ctx: this.numCtx },
      },
      { root: true },
    );

    const text = data?.message?.content ?? "";
    if (!text) throw new Error("Ollama returned an empty text response");

    return {
      text,
      model: data?.model || this.textModel,
      inputTokens: data?.prompt_eval_count ?? null,
      outputTokens: data?.eval_count ?? null,
    };
  }

  async embed(text) {
    if (!this.isConfigured()) throw new Error("Ollama is not enabled");
    if (!text) throw new Error("Text is required for embedding");

    const data = await this.#post("/embeddings", { model: this.embeddingModel, input: text }, { timeout: 60000 });
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec)) throw new Error("Invalid embedding response from Ollama");
    return vec;
  }

  // No image() method by design - see file header.
}
