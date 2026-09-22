/**
 * Shared upload/delete logic for any S3-compatible bucket (AWS S3, Cloudflare
 * R2, Backblaze B2, MinIO...). AWS S3 and Cloudflare R2 providers both build
 * on this with their own credentials/endpoint.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export function makeS3Client({ region, endpoint, accessKeyId, secretAccessKey, forcePathStyle = false }) {
  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function s3Upload(client, { bucket, key, buffer, contentType, publicUrl }) {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType })
  );
  return { url: `${publicUrl.replace(/\/$/, "")}/${key}`, key };
}

export async function s3Delete(client, { bucket, key }) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return true;
}
