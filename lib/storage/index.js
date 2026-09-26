import "server-only";
import { S3StorageProvider } from "./providers/s3.js";
import { R2StorageProvider } from "./providers/r2.js";
import { CloudinaryStorageProvider } from "./providers/cloudinary.js";
import { DiskStorageProvider } from "./providers/disk.js";

/**
 * Image storage chain, tried in order until one succeeds:
 *   1. AWS S3       - set AWS_S3_BUCKET + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
 *   2. Cloudflare R2 - set R2_ACCOUNT_ID + R2_BUCKET + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_PUBLIC_URL
 *   3. Cloudinary    - set CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET
 *   4. Disk          - always available, last resort (storage/images on this server)
 *
 * Set STORAGE_PROVIDER=s3 | r2 | cloudinary | disk in .env to force one
 * instead of the chain above (disk still backs it up if the forced one fails).
 *
 * Every uploaded image is tagged with the provider that actually stored it
 * (image_storage_provider / image_storage_key on the DB row) so a later
 * delete() always goes to the RIGHT place, even if the env config changes
 * which provider is "primary" afterwards.
 */
const REGISTRY = {
  s3: () => new S3StorageProvider(),
  r2: () => new R2StorageProvider(),
  cloudinary: () => new CloudinaryStorageProvider(),
  disk: () => new DiskStorageProvider(),
};

let cachedAll = null;
let cachedChain = null;

/** One instance per provider, reused for both the upload chain and one-off deletes. */
function allProviders() {
  if (!cachedAll) {
    cachedAll = Object.fromEntries(Object.entries(REGISTRY).map(([name, make]) => [name, make()]));
  }
  return cachedAll;
}

function buildChain() {
  const all = allProviders();
  const forced = (process.env.STORAGE_PROVIDER || "").toLowerCase();

  if (forced && all[forced]) {
    return forced === "disk" ? [all.disk] : [all[forced], all.disk];
  }

  const order = ["s3", "r2", "cloudinary"];
  const chain = order.filter((name) => all[name].isConfigured()).map((name) => all[name]);
  chain.push(all.disk); // always last - never fails to be "configured"
  return chain;
}

export function getStorageChain() {
  if (!cachedChain) cachedChain = buildChain();
  return cachedChain;
}

export function resetStorageChain() {
  cachedChain = null;
  cachedAll = null;
}

export function storageInfo() {
  const chain = getStorageChain();
  return { primary: chain[0].name, fallbackChain: chain.map((p) => p.name) };
}

/**
 * Uploads a buffer through the storage chain, falling through to the next
 * provider on failure. Disk is always last and never throws a "not
 * configured" error, so this call always succeeds (or every remote provider
 * AND disk itself failed, e.g. a full disk).
 */
export async function uploadImage(buffer, contentType, filename) {
  const chain = getStorageChain();
  let lastError = null;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    try {
      const result = await provider.upload({ buffer, contentType, key: filename });
      return { ...result, fallback: i > 0 };
    } catch (err) {
      lastError = err;
      // fall through to the next provider in the chain
    }
  }
  throw new Error(`Image upload failed on every storage provider: ${lastError?.message || "unknown"}`);
}

/**
 * Deletes from the SPECIFIC provider that originally stored the file - never
 * guesses, and never uses the current chain order (which may have changed
 * since the file was uploaded). Best-effort: logs and returns false instead
 * of throwing, so a failed cleanup delete never breaks the calling request.
 */
export async function deleteImage(provider, key) {
  if (!provider || !key) return false;
  const p = allProviders()[provider];
  if (!p) {
    console.error(`Cannot delete image: unknown storage provider "${provider}"`);
    return false;
  }
  try {
    await p.delete(key);
    return true;
  } catch (err) {
    console.error(`Image delete failed (${provider}/${key}):`, err.message);
    return false;
  }
}
