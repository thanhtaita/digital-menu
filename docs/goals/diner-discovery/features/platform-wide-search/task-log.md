## 2026-07-18 21:44 — Add platform-wide search across restaurants and dishes

New goal (`diner-discovery`) and feature. Adds `GET /public/search?q=` (rate-limited, `SEARCH_RATE_LIMIT`)
searching dish name/description/ingredient canonical names and restaurant name/description via `pg_trgm`
`similarity()` + `ILIKE`, matching the existing fuzzy-match pattern in `ai-ingredient-suggestion.ts`/
`fdc-matching.ts`. Adds trigram GIN indexes on `dishes`/`restaurants` name+description (migration `0012`
at the time this was built - see the 2026-07-19 entry below for a merge-time renumbering to `0013`).
Diner-app gets a search box in `SiteHeader` and on the homepage, plus a `/search?q=` results page grouped
into restaurants and dishes.

Recorded the Postgres-vs-dedicated-search-engine call as
[`ADR-003`](../../../../decisions/ADR-003-postgres-search-not-dedicated-engine.md).

Verified against seeded data: substring, fuzzy-typo, and ingredient-only matches all return the expected
dish/restaurant; a seeded inactive restaurant and a seeded unpublished-menu dish (both matchable) never
appear in results, confirming the visibility filter mirrors the existing public endpoints exactly.

While verifying migration `0012` against a freshly-migrated database, found (but did not fix - out of
scope) a pre-existing typo in `0005_translations.sql` that breaks a from-empty `drizzle-kit migrate` run;
recorded in `docs/architecture/known-gaps.md`.

## 2026-07-19 19:02 — Merge: renumbered the search migration to 0013

Merging `origin/main` into local `main` collided this feature's `0012_nebulous_vampiro.sql` (trigram
indexes) with an unrelated local-only `0012_salty_ironclad.sql` (diet-tag candidates table + FDC candidate
`fdc_data_type` column, from a separate, not-yet-pushed branch) that had already claimed migration index 12
- both `meta/_journal.json` and `meta/0012_snapshot.json` had a genuine collision, not just a text conflict.
Resolved by keeping `0012_salty_ironclad` at its index, deleting the incoming `0012_nebulous_vampiro.sql`,
and running `drizzle-kit generate` fresh against `schema.ts` (which already carries the trigram index
declarations) to produce `0013_marvelous_thunderbolts.sql` + a correctly chained `0013_snapshot.json` -
per the `db-migration` skill's guidance, regenerated rather than hand-patched. The generated SQL was
identical to the original migration's index-creation statements, minus a redundant
`CREATE EXTENSION IF NOT EXISTS pg_trgm` line - that extension was already enabled by `0011_pg_trgm.sql` on
the local-only branch, which `origin/main` didn't know about yet, so `docs/architecture/known-gaps.md`'s
pg_trgm bullet (which claimed migration `0012` was first to enable the extension) was corrected too.
