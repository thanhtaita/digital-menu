import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  extForMediaMime,
  maxBytesForMime,
  mediaKindFromMime,
  type MediaStorage,
  type SaveMediaResult
} from "./uploads.js";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

const REQUIRED_R2_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL"
] as const;

function getR2Config(): R2Config {
  const missing = REQUIRED_R2_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=r2 requires the following env vars, which are missing: ${missing.join(", ")}`
    );
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID as string,
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    bucket: process.env.R2_BUCKET as string,
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL as string).replace(/\/+$/, "")
  };
}

let cachedClient: S3Client | undefined;

function getR2Client(config: R2Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }
  return cachedClient;
}

function r2ObjectKey(subdir: string, filename: string): string {
  const safeSub = subdir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return `${safeSub}/${filename}`;
}

function r2PublicUrl(config: R2Config, key: string): string {
  return `${config.publicBaseUrl}/${key}`;
}

async function r2Save(buffer: Buffer, mime: string, subdir: string): Promise<SaveMediaResult> {
  const kind = mediaKindFromMime(mime);
  const ext = extForMediaMime(mime);
  if (!kind || !ext) {
    return { ok: false, status: 415, error: "Unsupported media type", code: "UNSUPPORTED_TYPE" };
  }
  const maxBytes = maxBytesForMime(mime);
  if (buffer.length > maxBytes) {
    return { ok: false, status: 413, error: "File too large", code: "FILE_TOO_LARGE" };
  }
  const config = getR2Config();
  const client = getR2Client(config);
  const filename = `${randomUUID()}${ext}`;
  const key = r2ObjectKey(subdir, filename);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mime
    })
  );
  return { ok: true, url: r2PublicUrl(config, key), kind };
}

/**
 * Best-effort delete for a public URL that was returned by r2Save. No-op for URLs that don't
 * start with the configured R2_PUBLIC_BASE_URL.
 */
async function r2DeleteByPublicUrl(publicUrl: string): Promise<void> {
  const config = getR2Config();
  const prefix = `${config.publicBaseUrl}/`;
  if (!publicUrl.startsWith(prefix)) return;
  const key = publicUrl.slice(prefix.length);
  const client = getR2Client(config);
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch {
    // ignore missing object
  }
}

export const r2MediaStorage: MediaStorage = {
  save: r2Save,
  deleteByPublicUrl: r2DeleteByPublicUrl
};
