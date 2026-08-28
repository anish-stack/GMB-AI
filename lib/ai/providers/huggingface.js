/**
 * Hugging Face provider.
 *
 * Text   -> Inference Router (OpenAI-compatible chat completions)
 * Embed  -> Inference Providers via @huggingface/inference
 * Image  -> Inference Providers via @huggingface/inference (auto provider selection)
 *
 * Server-side only. HF_API_KEY must never reach the browser.
 *
 * image() returns a raw Buffer, not a data URL. ImageService writes it to disk
 * and stores only a short URL, because a 1.2 MB image becomes ~1.7 MB of base64
 * and exceeds MySQL's default max_allowed_packet.
 */
import { InferenceClient } from "@huggingface/inference";

const ROUTER = "https://router.huggingface.co/v1/chat/completions";

export class HuggingFaceProvider {
  constructor() {
    this.name = "huggingface";
    this.apiKey = process.env.HF_API_KEY || "";
    this.textModel = process.env.HF_TEXT_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
    this.embeddingModel = process.env.HF_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
    this.imageModel = process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
    // auto | fal-ai | nscale | replicate | together ...
    this.imageProvider = process.env.HF_IMAGE_PROVIDER || "auto";
    this.timeout = Number(process.env.AI_TIMEOUT_MS || 30000);
    this.imageTimeout = Number(process.env.AI_IMAGE_TIMEOUT_MS || 60000);
    this.client = this.apiKey ? new InferenceClient(this.apiKey) : null;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async #post(url, body, { accept = "application/json", timeout = this.timeout } = {}) {
    if (!this.apiKey) throw new Error("HF_API_KEY not configured");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: accept,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      return res;
    } catch (err) {
      if (err?.name === "AbortError") throw new Error(`timeout after ${timeout} ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Text for every agent: research, keywords, topic, content, hashtags, QA. */
  async complete({ system, prompt, maxTokens = 600, temperature = 0.7, json = true }) {
    if (!this.isConfigured()) throw new Error("HF_API_KEY not configured");
    if (!prompt) throw new Error("Prompt is required");

    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const res = await this.#post(ROUTER, {
      model: this.textModel,
      messages,
      max_tokens: maxTokens,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Hugging Face returned an empty text response");

    return {
      text,
      model: data?.model || this.textModel,
      inputTokens: data?.usage?.prompt_tokens ?? data?.usage?.input_tokens ?? null,
      outputTokens: data?.usage?.completion_tokens ?? data?.usage?.output_tokens ?? null,
    };
  }

  async embed(text) {
    if (!this.client) throw new Error("HF_API_KEY not configured");
    if (!text) throw new Error("Text is required for embedding");

    const result = await this.client.featureExtraction({ model: this.embeddingModel, inputs: text });
    if (!Array.isArray(result)) throw new Error("Invalid embedding response from Hugging Face");
    if (typeof result[0] === "number") return result;

    if (Array.isArray(result[0])) {
      const dim = result[0].length;
      const out = new Array(dim).fill(0);
      let count = 0;
      for (const row of result) {
        if (!Array.isArray(row)) continue;
        count++;
        for (let i = 0; i < dim; i++) out[i] += Number(row[i]) || 0;
      }
      if (!count) throw new Error("Embedding response contains no vectors");
      return out.map((v) => v / count);
    }
    throw new Error("Unsupported embedding response format");
  }

  /** @returns {{buffer: Buffer, contentType: string, model: string, endpoint: string}} */
  async image(prompt) {
    if (!this.client) throw new Error("HF_API_KEY not configured");
    if (!this.imageModel) throw new Error("HF_IMAGE_MODEL not set in .env");
    if (!prompt) throw new Error("Image prompt is required");

    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`image generation timeout after ${this.imageTimeout} ms`)),
        this.imageTimeout
      );
    });

    try {
      const blob = await Promise.race([
        this.client.textToImage({
          model: this.imageModel,
          inputs: prompt,
          ...(this.imageProvider && this.imageProvider !== "auto" ? { provider: this.imageProvider } : {}),
        }),
        timeout,
      ]);

      if (!blob) throw new Error("Hugging Face returned an empty image");

      const buffer = Buffer.from(await blob.arrayBuffer());
      if (!buffer.length) throw new Error("Generated image buffer is empty");

      const contentType = blob.type || "image/png";
      if (!contentType.startsWith("image/")) throw new Error(`Invalid image content type: ${contentType}`);

      return {
        buffer,
        contentType,
        model: this.imageModel,
        endpoint: this.imageProvider === "auto" ? "inference-providers" : `inference-providers:${this.imageProvider}`,
      };
    } catch (err) {
      throw new Error(`HF image generation failed: ${err?.message || err}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
