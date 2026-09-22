/**
 * Cloudflare R2 storage provider - second in the image storage fallback chain.
 *
 * R2 is S3-compatible, so this reuses the same upload/delete calls as the S3
 * provider, just pointed at R2's account endpoint. R2 buckets are private by
 * default - you need R2_PUBLIC_URL (an r2.dev subdomain you've enabled, or a
 * custom domain mapped to the bucket) for the uploaded image to be servable.
 *
 * Env:
 *   R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_PUBLIC_URL  - required; e.g. https://pub-xxxx.r2.dev or a custom domain
 */
import { makeS3Client, s3Upload, s3Delete } from "./s3Compatible.js";

export class R2StorageProvider {
  constructor() {
    this.name = "r2";
    this.accountId = process.env.R2_ACCOUNT_ID || "";
    this.bucket = process.env.R2_BUCKET || "";
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
    this.publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
    this.client = null;
  }

  isConfigured() {
    return Boolean(this.accountId && this.bucket && this.accessKeyId && this.secretAccessKey && this.publicUrl);
  }

  #getClient() {
    if (!this.isConfigured()) {
      throw new Error(
        "Cloudflare R2 is not configured (R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_PUBLIC_URL)"
      );
    }
    if (!this.client) {
      this.client = makeS3Client({
        region: "auto",
        endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      });
    }
    return this.client;
  }

  async upload({ buffer, contentType, key }) {
    const { url } = await s3Upload(this.#getClient(), {
      bucket: this.bucket,
      key,
      buffer,
      contentType,
      publicUrl: this.publicUrl,
    });
    return { url, key, provider: this.name };
  }

  async delete(key) {
    return s3Delete(this.#getClient(), { bucket: this.bucket, key });
  }
}
