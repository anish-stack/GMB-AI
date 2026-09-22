/**
 * Gemini provider.
 *
 * Text   -> generateContent (JSON mode via responseMimeType when requested)
 * Embed  -> embedContent
 * Image  -> generateContent with responseModalities ["TEXT","IMAGE"]
 *           (gemini-2.5-flash-image, aka "nano banana", by default). Returns
 *           a raw Buffer, same shape as the OpenAI/Hugging Face providers, so
 *           ImageService can save it to disk unchanged - the DB only ever
 *           stores a short /api/media/... URL.
 *
 * Server-side only. GEMINI_API_KEY must never reach the browser.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiProvider {
  constructor() {
    this.name = "gemini";
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.textModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    this.embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
    this.imageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
    this.timeout = Number(process.env.AI_TIMEOUT_MS || 30000);
    this.imageTimeout = Number(process.env.AI_IMAGE_TIMEOUT_MS || 60000);
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async #post(path, body, { timeout = this.timeout } = {}) {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY not configured");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-goog-api-key": this.apiKey,
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
    if (!this.isConfigured()) throw new Error("GEMINI_API_KEY not configured");
    if (!prompt) throw new Error("Prompt is required");

    const data = await this.#post(`/models/${this.textModel}:generateContent`, {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    });

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text) throw new Error("Gemini returned an empty text response");

    return {
      text,
      model: this.textModel,
      inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
    };
  }

  async embed(text) {
    if (!this.isConfigured()) throw new Error("GEMINI_API_KEY not configured");
    if (!text) throw new Error("Text is required for embedding");

    const data = await this.#post(`/models/${this.embeddingModel}:embedContent`, {
      content: { parts: [{ text }] },
    });

    const vec = data?.embedding?.values;
    if (!Array.isArray(vec)) throw new Error("Invalid embedding response from Gemini");
    return vec;
  }

  /** @returns {{buffer: Buffer, contentType: string, model: string, endpoint: string}} */
  async image(prompt) {
    if (!this.isConfigured()) throw new Error("GEMINI_API_KEY not configured");
    if (!this.imageModel) throw new Error("GEMINI_IMAGE_MODEL not set in .env");
    if (!prompt) throw new Error("Image prompt is required");

    const data = await this.#post(
      `/models/${this.imageModel}:generateContent`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      },
      { timeout: this.imageTimeout }
    );

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = imagePart?.inlineData || imagePart?.inline_data;
    if (!inline?.data) throw new Error("Gemini returned no usable image data");

    const buffer = Buffer.from(inline.data, "base64");
    if (!buffer.length) throw new Error("Generated image buffer is empty");

    return {
      buffer,
      contentType: inline.mimeType || inline.mime_type || "image/png",
      model: this.imageModel,
      endpoint: "generateContent",
    };
  }
}
