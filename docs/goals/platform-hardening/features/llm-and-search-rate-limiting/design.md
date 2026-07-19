# Design: LLM and search rate limiting

## Opt-in, not global

`@fastify/rate-limit` is registered with `global: false` - it does nothing to a route unless that route's
handler explicitly passes `config: { rateLimit: ... }`. This was a deliberate scoping choice: only routes
with a real cost or abuse concern (calls a paid LLM provider, or is cheaply scrapeable) opt in, rather than
rate-limiting the entire API surface in one pass. The tradeoff is explicit in
[`docs/architecture/known-gaps.md`](../../../../architecture/known-gaps.md): every other route (auth,
restaurant/menu/dish CRUD, social layer, uploads) remains unthrottled by design scope, not oversight.

## Bucketing: session first, IP fallback

`rateLimitKeyGenerator` reads the session cookie directly (`getSessionIdFromCookie`, the same helper
`middleware/auth.ts` uses) and buckets by `user:<sessionId>` when present, `ip:<request.ip>` otherwise.
Session-based bucketing is preferred because it doesn't penalize multiple users behind the same IP (e.g. a
shared office network) and can't be trivially defeated by rotating IPs while staying logged in as the same
user - but since some of the throttled routes don't strictly require auth in all cases, the IP fallback
still exists so an unauthenticated caller can't bypass the limit entirely by omitting the cookie.

## Two limits, not one

- `LLM_RATE_LIMIT` (20/min) applies to the AI chat and ingredient-suggestion routes - these call a paid
  LLM provider per request, so the limit is tight.
- `SEARCH_RATE_LIMIT` (60/min) applies to ingredient search - cheap per call (a `pg_trgm` query, no LLM
  involved) but still worth capping against scraping, so the limit is looser than the LLM routes rather
  than equally tight.

Both constants live in one place (`lib/rate-limit.ts`) rather than being inlined per-route, so the two
tiers stay easy to compare and adjust together.
