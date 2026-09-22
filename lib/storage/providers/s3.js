/**
 * AWS S3 storage provider - first in the image storage fallback chain.
 *
 * Requires an S3 bucket with public read (or a CloudFront/CDN domain in front
 * of it) so the generated image URL is directly usable in GMB posts.
 *
 * Env:
 *   AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   AWS_S3_PUBLIC_URL  - optional CDN/custom domain in front of the bucket;
 *                        defaults to the bucket's regional S3 URL.
 */
import { makeS3Client, s3Upload, s3Delete } from "./s3Compatible.js";

export class S3StorageProvider {
  constructor() {
    this.name = "s3";
    this.bucket = process.env.AWS_S3_BUCKET || "";
    this.region = process.env.AWS_S3_REGION || "us-east-1";
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID || "";
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || "";
    this.publicUrl =
      (process.env.AWS_S3_PUBLIC_URL || `https://${this.bucket}.s3.${this.region}.amazonaws.com`).replace(
        /\/$/,
        ""
      );
    this.client = null;
  }

  isConfigured() {
    return Boolean(this.bucket && this.accessKeyId && this.secretAccessKey);
  }

  #getClient() {
    if (!this.isConfigured()) throw new Error("AWS S3 is not configured (AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)");
    if (!this.client) {
      this.client = makeS3Client({
        region: this.region,
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
