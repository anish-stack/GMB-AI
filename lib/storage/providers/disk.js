/**
 * Local disk storage provider - last resort, always "configured" (needs no
 * keys), so the chain never fails to store an image somewhere. Served back
 * out by app/api/media/[file]/route.js.
 */
import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_DIR = process.env.IMAGE_STORAGE_DIR || path.join(process.cwd(), "storage", "images");

export class DiskStorageProvider {
  constructor() {
    this.name = "disk";
  }

  isConfigured() {
    return true;
  }

  async upload({ buffer, contentType, key }) {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const name = path.basename(key);
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ STORAGE_DIR, name), buffer);
    return { url: `/api/media/${name}`, key: name, provider: this.name };
  }

  async delete(key) {
    try {
      await fs.unlink(path.join(/*turbopackIgnore: true*/ STORAGE_DIR, path.basename(key)));
      return true;
    } catch (err) {
      if (err.code === "ENOENT") return true; // already gone - fine
      throw err;
    }
  }
}
