## 2026-07-12 17:31 — Add rate limiting to LLM-backed and ingredient search endpoints

**Commit:** cd860ea

AI chat (`/chat`, `/chat/stream`), ingredient suggestions, and ingredient search had only session auth and
no throttle, exposing unbounded calls to paid LLM providers and scraping of fuzzy search. Registers
`@fastify/rate-limit` globally with `global: false` (opt-in per route via `config.rateLimit`) and scopes
buckets per authenticated session, falling back to per-IP.
