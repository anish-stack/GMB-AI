/**
 * Cloudinary storage provider - third in the image storage fallback chain.
 * Talks to the plain REST API (signed uploads) so no extra SDK is needed.
 *
 * Env:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   CLOUDINARY_FOLDER  - optional, defaults to "gmb-posts"
 */
import crypto from "node:crypto";

const TIMEOUT = Number(process.env.AI_IMAGE_TIMEOUT_MS || 60000);

export class CloudinaryStorageProvider {
  constructor() {
    this.name = "cloudinary";
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    this.apiKey = process.env.CLOUDINARY_API_KEY || "";
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || "";
    this.folder = process.env.CLOUDINARY_FOLDER || "gmb-posts";
  }

  isConfigured() {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  /** Cloudinary signature = sha1(sorted "k=v&k=v..." + api_secret), hex. */
  #sign(params) {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    return crypto.createHash("sha1").update(`${toSign}${this.apiSecret}`).digest("hex");
  }

  async #fetch(url, options, timeout = TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
      return await res.json();
    } catch (err) {
      if (err?.name === "AbortError") throw new Error(`timeout after ${timeout} ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async upload({ buffer, contentType, key }) {
    if (!this.isConfigured()) throw new Error("Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)");

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = String(key).replace(/\.[a-zA-Z0-9]+$/, "");
    const signature = this.#sign({ timestamp, folder: this.folder, public_id: publicId });

    const form = new FormData();
    form.append("file", new Blob([buffer], { type: contentType }), key);
    form.append("api_key", this.apiKey);
    form.append("timestamp", String(timestamp));
    form.append("folder", this.folder);
    form.append("public_id", publicId);
    form.append("signature", signature);

    const data = await this.#fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    if (!data.secure_url) throw new Error("Cloudinary returned no secure_url");

    // Store the full public_id (folder included) as our "key" - that's what destroy() needs back.
    return { url: data.secure_url, key: data.public_id || `${this.folder}/${publicId}`, provider: this.name };
  }

  async delete(key) {
    if (!this.isConfigured()) throw new Error("Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)");

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.#sign({ timestamp, public_id: key });
    const body = new URLSearchParams({
      public_id: key,
      timestamp: String(timestamp),
      api_key: this.apiKey,
      signature,
    });

    const data = await this.#fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (data.result !== "ok" && data.result !== "not found") {
      throw new Error(`Cloudinary destroy returned "${data.result}"`);
    }
    return true;
  }
}
