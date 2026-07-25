import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import type { MultipartFile } from "@fastify/multipart";
import { r2MediaStorage } from "./uploads-r2.js";

/** Public URL prefix (served by @fastify/static). */
export const UPLOAD_PUBLIC_PREFIX = "/uploads";

/** Max upload size for images (multipart limit should be at least this). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Max upload size for videos. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Largest multipart body the API accepts (images or videos). */
export const MAX_MULTIPART_BYTES = Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES);

const IMAGE_MIME_TO_EXT = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const VIDEO_MIME_TO_EXT = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"]
]);

export type MediaKind = "image" | "video";

export function getUploadRoot(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
}

export async function ensureUploadRoot(): Promise<void> {
  await mkdir(getUploadRoot(), { recursive: true });
}

export function extForImageMime(mime: string): string | undefined {
  return IMAGE_MIME_TO_EXT.get(mime);
}

function extForVideoMime(mime: string): string | undefined {
  return VIDEO_MIME_TO_EXT.get(mime);
}

export function mediaKindFromMime(mime: string): MediaKind | undefined {
  if (IMAGE_MIME_TO_EXT.has(mime)) return "image";
  if (VIDEO_MIME_TO_EXT.has(mime)) return "video";
  return undefined;
}

export function extForMediaMime(mime: string): string | undefined {
  return extForImageMime(mime) ?? extForVideoMime(mime);
}

export function maxBytesForMime(mime: string): number {
  return IMAGE_MIME_TO_EXT.has(mime) ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

export function publicMediaPath(subdir: string, filename: string): string {
  const safeSub = subdir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return `${UPLOAD_PUBLIC_PREFIX}/${safeSub}/${filename}`;
}

export type SaveImageResult =
  | { ok: true; imageUrl: string }
  | { ok: false; status: 400 | 413 | 415; error: string; code?: string };

export type SaveMediaResult =
  | { ok: true; url: string; kind: MediaKind }
  | { ok: false; status: 400 | 413 | 415; error: string; code?: string };

/**
 * Persists uploaded bytes and returns a public URL string (path or future https URL).
 * Local implementation writes under UPLOAD_DIR; cloud implementations return bucket URLs.
 */
export interface MediaStorage {
  save(buffer: Buffer, mime: string, subdir: string): Promise<SaveMediaResult>;
  /** Best-effort delete when url is an upload we own (e.g. /uploads/...). No-op for unknown URLs. */
  deleteByPublicUrl(publicUrl: string): Promise<void>;
}

async function localSave(buffer: Buffer, mime: string, subdir: string): Promise<SaveMediaResult> {
  const kind = mediaKindFromMime(mime);
  const ext = extForMediaMime(mime);
  if (!kind || !ext) {
    return { ok: false, status: 415, error: "Unsupported media type", code: "UNSUPPORTED_TYPE" };
  }
  const maxBytes = maxBytesForMime(mime);
  if (buffer.length > maxBytes) {
    return { ok: false, status: 413, error: "File too large", code: "FILE_TOO_LARGE" };
  }
  const dir = join(getUploadRoot(), subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(join(dir, filename), buffer);
  return { ok: true, url: publicMediaPath(subdir, filename), kind };
}

/**
 * Deletes a file under the local upload root when publicUrl is `/uploads/...`.
 */
export async function deleteLocalUploadByPublicUrl(publicUrl: string): Promise<void> {
  if (!publicUrl.startsWith(`${UPLOAD_PUBLIC_PREFIX}/`)) return;
  const relative = publicUrl.slice(UPLOAD_PUBLIC_PREFIX.length + 1);
  const abs = join(getUploadRoot(), relative);
  const root = getUploadRoot();
  if (!abs.startsWith(root)) return;
  try {
    await unlink(abs);
  } catch {
    // ignore missing file
  }
}

export const localMediaStorage: MediaStorage = {
  save: localSave,
  deleteByPublicUrl: deleteLocalUploadByPublicUrl
};

/**
 * Storage driver selector. Set STORAGE_DRIVER=r2 to route all uploads through Cloudflare R2
 * instead of local disk; any other value (or unset) keeps today's local-disk behavior with
 * zero configuration. The R2 client/env vars are only touched when "r2" is actually selected.
 */
export const mediaStorage: MediaStorage =
  process.env.STORAGE_DRIVER === "r2" ? r2MediaStorage : localMediaStorage;

/**
 * Reads one multipart file, validates type/size, writes via storage (default: local disk).
 */
export async function saveMultipartMedia(
  file: MultipartFile | undefined,
  subdir: string,
  storage: MediaStorage = localMediaStorage
): Promise<SaveMediaResult> {
  if (!file) {
    return { ok: false, status: 400, error: "No file", code: "NO_FILE" };
  }
  const buffer = await file.toBuffer();
  return storage.save(buffer, file.mimetype, subdir);
}

/**
 * Image-only upload (ingredients, legacy dish primary image).
 */
export async function saveMultipartImage(
  file: MultipartFile | undefined,
  subdir: string,
  storage: MediaStorage = localMediaStorage
): Promise<SaveImageResult> {
  if (!file) {
    return { ok: false, status: 400, error: "No file", code: "NO_FILE" };
  }
  if (!IMAGE_MIME_TO_EXT.has(file.mimetype)) {
    return { ok: false, status: 415, error: "Unsupported image type", code: "UNSUPPORTED_TYPE" };
  }
  const buffer = await file.toBuffer();
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, error: "File too large", code: "FILE_TOO_LARGE" };
  }
  const result = await storage.save(buffer, file.mimetype, subdir);
  if (!result.ok) return result;
  return { ok: true, imageUrl: result.url };
}
