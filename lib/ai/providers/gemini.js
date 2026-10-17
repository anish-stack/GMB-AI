/**
 * Gemini provider.
 *
 * Text   -> generateContent (JSON mode via responseMimeType when requested)
 * Embed  -> embedContent
 * Image  -> generateContent with responseModalities ["TEXT","IMAGE"]
 *           Returns a raw Buffer, same shape as the OpenAI/Hugging Face providers,
 *           so ImageService can save it unchanged.
 *
 * Server-side only. GEMINI_API_KEY must never reach the browser.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

const debug = (...args) => {
  if (process.env.AI_DEBUG === "1") console.log(...args);
};

/** Finish reasons that mean the model did not complete a normal answer. */
const BAD_FINISH = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "MALFORMED_FUNCTION_CALL",
  "OTHER",
]);

function tryParse(s) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a string that parses as JSON, or null.
 * Tries: raw text, fence-stripped text, first "{" to last "}", and the same
 * slice with trailing commas removed.
 */
function repairJson(text) {
  if (tryParse(text)) return text;
  const stripped = String(text)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  if (tryParse(stripped)) return stripped;
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  const sliced = stripped.slice(start, end + 1);
  if (tryParse(sliced)) return sliced;
  const noTrailingCommas = sliced.replace(/,\s*([}\]])/g, "$1");
  return tryParse(noTrailingCommas) ? noTrailingCommas : null;
}

export class GeminiProvider {
  constructor() {
    this.name = "gemini";
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.textModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    this.embeddingModel =
      process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
    this.imageModel =
      process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
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
      if (!res.ok) {
        throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      }
      return await res.json();
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error(`timeout after ${timeout} ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async complete({
    system,
    prompt,
    maxTokens = 1024,
    temperature = 0.7,
    json = true,
    schema = null,
  }) {
    if (!this.isConfigured()) throw new Error("GEMINI_API_KEY not configured");
    if (!prompt) throw new Error("Prompt is required");

    const generationConfig = {
      // Thinking models spend output budget on thoughts, so never go below 1024.
      maxOutputTokens: Math.max(Number(maxTokens) || 1024, 1024),
      temperature,

      ...(json
        ? {
            responseMimeType: "application/json",
            // A schema is applied ONLY when the calling agent passes one.
            // A fixed schema here would force every agent into the same shape.
            ...(schema ? { responseSchema: schema } : {}),
          }
        : {}),

      // Gemini 3 models use thinkingLevel. LOW is enough for writing tasks.
      ...(String(this.textModel).startsWith("gemini-3")
        ? { thinkingConfig: { thinkingLevel: "LOW" } }
        : {}),
    };

    debug("[GEMINI] Request", {
      model: this.textModel,
      maxTokens,
      effectiveMaxOutputTokens: generationConfig.maxOutputTokens,
      temperature,
      json,
      hasSchema: Boolean(schema),
    });

    const data = await this.#post(`/models/${this.textModel}:generateContent`, {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });

    // Prompt blocked before any candidate was produced.
    if (data?.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini blocked the prompt. Reason: ${data.promptFeedback.blockReason}`,
      );
    }

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const finishReason = candidate?.finishReason || null;

    // Skip "thought" parts. Thinking models can return them, and gluing thought
    // text in front of the JSON makes JSON.parse fail even when finishReason is STOP.
    const text = parts
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("")
      .trim();

    debug("[GEMINI] Response", {
      model: this.textModel,
      finishReason,
      finishMessage: candidate?.finishMessage || null,
      promptTokens: data?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
      thinkingTokens: data?.usageMetadata?.thoughtsTokenCount ?? null,
      totalTokens: data?.usageMetadata?.totalTokenCount ?? null,
      outputLength: text.length,
      output: text,
    });

    // Do not let truncated output reach runAI as a success.
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        `Gemini response was truncated because max output tokens were reached. Model: ${this.textModel}`,
      );
    }

    if (finishReason && BAD_FINISH.has(finishReason)) {
      throw new Error(
        `Gemini stopped early. Finish reason: ${finishReason}${
          candidate?.finishMessage ? ` (${candidate.finishMessage})` : ""
        }`,
      );
    }

    if (!text) {
      throw new Error(
        `Gemini returned an empty text response. Finish reason: ${finishReason || "unknown"}`,
      );
    }

    // JSON mode must return valid JSON. Repair small formatting slips first,
    // otherwise throw so runAI retries or falls back.
    let finalText = text;
    if (json) {
      const repaired = repairJson(text);
      if (!repaired) {
        console.error(
          "[GEMINI] Invalid JSON response:",
          text.slice(0, 2000),
        );
        throw new Error(
          `Gemini returned incomplete or invalid JSON. Finish reason: ${finishReason || "unknown"}`,
        );
      }
      if (repaired !== text) debug("[GEMINI] JSON repaired");
      finalText = repaired;
    }

    return {
      text: finalText,
      model: this.textModel,
      inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
    };
  }

  async embed(text) {
    if (!this.isConfigured()) throw new Error("GEMINI_API_KEY not configured");
    if (!text) throw new Error("Text is required for embedding");

    const data = await this.#post(
      `/models/${this.embeddingModel}:embedContent`,
      { content: { parts: [{ text }] } },
    );

    const vec = data?.embedding?.values;
    if (!Array.isArray(vec)) {
      throw new Error("Invalid embedding response from Gemini");
    }
    return vec;
  }

  /** @returns {{buffer: Buffer, contentType: string, model: string, endpoint: string}} */
  async image(prompt, { aspectRatio = null } = {}) {
    if (!this.isConfigured()) throw new Error("GEMINI_API_KEY not configured");
    if (!this.imageModel) throw new Error("GEMINI_IMAGE_MODEL not set in .env");
    if (!prompt) throw new Error("Image prompt is required");

    const body = (withRatio) => ({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(withRatio && aspectRatio ? { imageConfig: { aspectRatio } } : {}),
      },
    });
    let data;
    try {
      data = await this.#post(`/models/${this.imageModel}:generateContent`, body(true), { timeout: this.imageTimeout });
    } catch (err) {
      // older image models don't know imageConfig -> retry without the aspect ratio
      if (!aspectRatio || !/imageConfig|aspect|Invalid JSON payload|Unknown name/i.test(String(err.message))) throw err;
      data = await this.#post(`/models/${this.imageModel}:generateContent`, body(false), { timeout: this.imageTimeout });
    }

    if (data?.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini blocked the image prompt. Reason: ${data.promptFeedback.blockReason}`,
      );
    }

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const imagePart = parts.find(
      (p) => p.inlineData?.data || p.inline_data?.data,
    );
    const inline = imagePart?.inlineData || imagePart?.inline_data;

    if (!inline?.data) {
      const reason = candidate?.finishReason ? ` Finish reason: ${candidate.finishReason}.` : "";
      throw new Error(`Gemini returned no usable image data.${reason}`);
    }

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