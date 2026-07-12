import type { FastifyRequest } from "fastify";
import { getSessionIdFromCookie } from "./auth.js";

/** Groups rate-limit buckets per authenticated session where available, falling back to per-IP. */
export function rateLimitKeyGenerator(request: FastifyRequest): string {
  const sessionId = getSessionIdFromCookie(request.headers.cookie);
  return sessionId ? `user:${sessionId}` : `ip:${request.ip}`;
}

/** LLM-backed routes (chat, ingredient suggestions) are the expensive/abusable ones. */
export const LLM_RATE_LIMIT = { max: 20, timeWindow: "1 minute" };

/** Fuzzy ingredient search is cheap per-call but scrapeable; keep it looser than the LLM routes. */
export const SEARCH_RATE_LIMIT = { max: 60, timeWindow: "1 minute" };
