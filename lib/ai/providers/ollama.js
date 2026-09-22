/**
 * Ollama provider - free, local text + embeddings, tried before the paid
 * providers when enabled. No image generation: Ollama runs LLMs, not
 * diffusion models, so it has no image() method and the chain naturally
 * skips it for image generation (falls straight to OpenAI/Hugging Face).
 *
 * Requires Ollama running locally (https://ollama.com) with a model pulled:
 *   ollama pull llama3.2
 *   ollama pull nomic-embed-text
 *
 * Off by default - set OLLAMA_ENABLED=true in .env to turn it on. Meant for
 * a dev machine; leave it unset/false on the production VPS.
 */
export class OllamaProvider {
  constructor() {
    this.name = "ollama";
    this.enabled = String(process.env.OLLAMA_ENABLED || "").toLowerCase() === "true";
    this.baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "");
    this.apiKey = process.env.OLLAMA_API_KEY || ""; // only needed if you've put Ollama behind an auth proxy
    this.textModel = process.env.OLLAMA_TEXT_MODEL || "llama3.2";
    this.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
    this.imageModel = null; // no image generation support
    this.timeout = Number(process.env.AI_TIMEOUT_MS || 30000);
  }

  isConfigured() {
    return this.enabled;
  }

  async #post(path, body, { timeout = this.timeout } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
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
      if (err?.name === "AbortError") throw new Error(`timeout after ${timeout} ms - is Ollama running?`);
      if (err?.cause?.code === "ECONNREFUSED" || err?.code === "ECONNREFUSED") {
        throw new Error(`Could not reach Ollama at ${this.baseUrl} - is "ollama serve" running?`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async complete({ system, prompt, maxTokens = 600, temperature = 0.7, json = true }) {
    if (!this.isConfigured()) throw new Error("OLLAMA_ENABLED is not true");
    if (!prompt) throw new Error("Prompt is required");

    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const data = await this.#post("/chat/completions", {
      model: this.textModel,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });

    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Ollama returned an empty text response");

    return {
      text,
      model: data?.model || this.textModel,
      inputTokens: data?.usage?.prompt_tokens ?? null,
      outputTokens: data?.usage?.completion_tokens ?? null,
    };
  }

  async embed(text) {
    if (!this.isConfigured()) throw new Error("OLLAMA_ENABLED is not true");
    if (!text) throw new Error("Text is required for embedding");

    const data = await this.#post("/embeddings", {
      model: this.embeddingModel,
      input: text,
    });

    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec)) throw new Error("Invalid embedding response from Ollama");
    return vec;
  }

  // No image() method by design - see file header.
}
