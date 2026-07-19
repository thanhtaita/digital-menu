## 2026-07-18 21:44 — Add platform-wide search across restaurants and dishes

New goal (`diner-discovery`) and feature. Adds `GET /public/search?q=` (rate-limited, `SEARCH_RATE_LIMIT`)
searching dish name/description/ingredient canonical names and restaurant name/description via `pg_trgm`
`similarity()` + `ILIKE`, matching the existing fuzzy-match pattern in `ai-ingredient-suggestion.ts`/
`fdc-matching.ts`. Adds trigram GIN indexes on `dishes`/`restaurants` name+description (migration `0012`,
which also enables `pg_trgm` - the first migration to do so). Diner-app gets a search box in `SiteHeader`
and on the homepage, plus a `/search?q=` results page grouped into restaurants and dishes.

Recorded the Postgres-vs-dedicated-search-engine call as
[`ADR-003`](../../../../decisions/ADR-003-postgres-search-not-dedicated-engine.md).

Verified against seeded data: substring, fuzzy-typo, and ingredient-only matches all return the expected
dish/restaurant; a seeded inactive restaurant and a seeded unpublished-menu dish (both matchable) never
appear in results, confirming the visibility filter mirrors the existing public endpoints exactly.

While verifying migration `0012` against a freshly-migrated database, found (but did not fix - out of
scope) a pre-existing typo in `0005_translations.sql` that breaks a from-empty `drizzle-kit migrate` run;
recorded in `docs/architecture/known-gaps.md`.
