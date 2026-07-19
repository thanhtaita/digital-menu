# Feature: rate limiting on LLM-backed and ingredient-search endpoints

## What it does

AI chat (`/chat`, `/chat/stream`), the AI ingredient-suggestion endpoint, and ingredient search
(`GET /ingredients`) previously had only session auth and no throttle - any authenticated caller (or an
unauthenticated one, via IP fallback where applicable) could drive unbounded calls to paid LLM providers or
scrape the ingredient dictionary via repeated fuzzy search. These four routes now enforce a per-minute
request cap, bucketed per authenticated session where available and falling back to per-IP otherwise. No
other route in the API is throttled - see
[`docs/architecture/known-gaps.md`](../../../../architecture/known-gaps.md).

## Entry points in code

- `apps/api/src/app.ts` - registers `@fastify/rate-limit` globally with `global: false` (opt-in per route
  only), wired to `rateLimitKeyGenerator`.
- `apps/api/src/lib/rate-limit.ts` - `rateLimitKeyGenerator` (session-cookie-first, IP-fallback bucketing),
  `LLM_RATE_LIMIT` (20/min), `SEARCH_RATE_LIMIT` (60/min).
- `apps/api/src/routes/ai-chat.ts`, `apps/api/src/routes/ai-suggestions.ts` - opt in via
  `config: { rateLimit: LLM_RATE_LIMIT }`.
- `apps/api/src/routes/ingredients.ts` - `GET /` (search) opts in via
  `config: { rateLimit: SEARCH_RATE_LIMIT }`.

## See also

- [`design.md`](./design.md) - why the two routes have different limits, and the bucketing tradeoff
- [`task-log.md`](./task-log.md) - chronological history
