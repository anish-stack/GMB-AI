/**
 * Shared upload/delete logic for any S3-compatible bucket (AWS S3, Cloudflare
 * R2, Backblaze B2, MinIO...). AWS S3 and Cloudflare R2 providers both build
 * on this with their own credentials/endpoint.
 *
 * The AWS SDK is loaded lazily at runtime (not bundled), so a missing
 * "@aws-sdk/client-s3" install never breaks the build/pages - the provider
 * just fails and the storage chain falls through to the next one.
 */
let sdkPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    const pkg = "@aws-sdk/client-s3";
    sdkPromise = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ pkg).catch((err) => {
      sdkPromise = null;
      throw new Error(`"${pkg}" is not installed - run: npm install ${pkg} (${err.message})`);
    });
  }
  return sdkPromise;
}

export function makeS3Client({ region, endpoint, accessKeyId, secretAccessKey, forcePathStyle = false }) {
  return {
    config: {
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    },
    sdk: null,
    client: null,
  };
}

async function resolve(holder) {
  if (!holder.client) {
    holder.sdk = await loadSdk();
    holder.client = new holder.sdk.S3Client(holder.config);
  }
  return holder;
}

export async function s3Upload(holder, { bucket, key, buffer, contentType, publicUrl }) {
  const { sdk, client } = await resolve(holder);
  await client.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
  return { url: `${publicUrl.replace(/\/$/, "")}/${key}`, key };
}

export async function s3Delete(holder, { bucket, key }) {
  const { sdk, client } = await resolve(holder);
  await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return true;
}
