/**
 * API origin for static files (e.g. `/uploads/...`) derived from the same base as JSON API calls.
 */
export function getApiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";
  try {
    return new URL(base).origin;
  } catch {
    return "http://localhost:3002";
  }
}

/** Turn stored `imageUrl` into a browser-loadable URL (absolute http(s) or API `/uploads/...`). */
export function resolvePublicImageUrl(url: string | null | undefined): string | undefined {
  if (url == null || url === "") return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) {
    return `${getApiOrigin()}${url}`;
  }
  return url;
}
