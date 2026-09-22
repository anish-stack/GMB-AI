/**
 * OpenAI provider - primary AI provider (tried first; Hugging Face is the fallback).
 *
 * Text   -> Chat Completions (JSON mode when requested)
 * Embed  -> Embeddings API
 * Image  -> Images API (gpt-image-1 by default). Returns a raw Buffer, same shape
 *           as the Hugging Face provider, so ImageService can save it to disk
 *           unchanged and the DB only ever stores a short /api/media/... URL.
 *
 * Server-side only. OPENAI_API_KEY must never reach the browser.
 */
const BASE = "https://api.openai.com/v1";

export class OpenAIProvider {
  constructor() {
    this.name = "openai";
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.textModel = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
    this.imageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    this.imageSize = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
    this.timeout = Number(process.env.AI_TIMEOUT_MS || 30000);
    this.imageTimeout = Number(process.env.AI_IMAGE_TIMEOUT_MS || 60000);
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async #post(path, body, { timeout = this.timeout } = {}) {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY not configured");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (err) {
      if (err?.name === "AbortError") throw new Error(`timeout after ${timeout} ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Text for every agent: research, keywords, topic, content, hashtags, QA. */
  async complete({ system, prompt, maxTokens = 600, temperature = 0.7, json = true }) {
    if (!this.isConfigured()) throw new Error("OPENAI_API_KEY not configured");
    if (!prompt) throw new Error("Prompt is required");

    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const data = await this.#post("/chat/completions", {
      model: this.textModel,
      messages,
      max_completion_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });

    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("OpenAI returned an empty text response");

    return {
      text,
      model: data?.model || this.textModel,
      inputTokens: data?.usage?.prompt_tokens ?? null,
      outputTokens: data?.usage?.completion_tokens ?? null,
    };
  }

  async embed(text) {
    if (!this.isConfigured()) throw new Error("OPENAI_API_KEY not configured");
    if (!text) throw new Error("Text is required for embedding");

    const data = await this.#post("/embeddings", {
      model: this.embeddingModel,
      input: text,
    });

    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec)) throw new Error("Invalid embedding response from OpenAI");
    return vec;
  }

  /** @returns {{buffer: Buffer, contentType: string, model: string, endpoint: string}} */
  async image(prompt) {
    if (!this.isConfigured()) throw new Error("OPENAI_API_KEY not configured");
    if (!this.imageModel) throw new Error("OPENAI_IMAGE_MODEL not set in .env");
    if (!prompt) throw new Error("Image prompt is required");

    const body = { model: this.imageModel, prompt, size: this.imageSize, n: 1 };
    // gpt-image-1 always returns b64_json and rejects response_format; dall-e-2/3 need it explicit.
    if (this.imageModel.startsWith("dall-e")) body.response_format = "b64_json";

    const data = await this.#post("/images/generations", body, { timeout: this.imageTimeout });
    const item = data?.data?.[0];
    if (!item) throw new Error("OpenAI returned no image");

    let buffer;
    if (item.b64_json) {
      buffer = Buffer.from(item.b64_json, "base64");
    } else if (item.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } else {
      throw new Error("OpenAI image response has no usable image data");
    }
    if (!buffer.length) throw new Error("Generated image buffer is empty");

    return {
      buffer,
      contentType: "image/png",
      model: this.imageModel,
      endpoint: "images.generations",
    };
  }
}
