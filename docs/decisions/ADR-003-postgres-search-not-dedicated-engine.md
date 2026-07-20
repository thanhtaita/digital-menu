# ADR-003: Platform-wide search stays in Postgres, no dedicated search engine

**Status:** Accepted
**Date:** 2026-07-18

## Context

Platform-wide search (across all restaurants' dishes and menus, not just one restaurant's menu) needs
fuzzy/typo-tolerant matching over dish names, dish descriptions, ingredient names, and restaurant
names/descriptions. The obvious "proper" way to build this at larger scale is a dedicated search engine
(OpenSearch, Elasticsearch, Meilisearch, etc.) with its own index, sync pipeline, and query language.

This project has no deployment configuration yet - see
[`docs/operations/deployment.md`](../operations/deployment.md) - it runs local-dev only, straight against a
single Postgres instance. There is nowhere to host a separate search cluster even if one were built, and the
current catalog scale (a handful of seeded restaurants/dishes) does not come close to needing one. The
codebase also already has a working, established fuzzy-match pattern - `pg_trgm` `similarity()` - used by
`apps/api/src/services/ai-ingredient-suggestion.ts` and `apps/api/src/services/fdc-matching.ts`.

## Decision

Implement platform-wide search entirely inside the existing Postgres database:

- `pg_trgm` trigram GIN indexes on `dishes.name`, `dishes.description`, `restaurants.name`, and
  `restaurants.description` (migration `0012`), extending the same `similarity()`-based fuzzy-match
  technique already used elsewhere in this codebase, rather than introducing a new query language or
  index type.
- No new service, container, or infrastructure dependency. No OpenSearch/Elasticsearch/Meilisearch.

See [`docs/goals/diner-discovery/features/platform-wide-search/design.md`](../goals/diner-discovery/features/platform-wide-search/design.md)
for the query/index implementation details.

## Rejected alternative

A dedicated search engine (OpenSearch/Elasticsearch/Meilisearch) was considered and rejected for this pass:

- **No deployment infrastructure to host it on.** The project has no deployment config at all yet; adding a
  second stateful service would be infrastructure work with nowhere to run in production, only locally.
- **Catalog scale doesn't warrant it.** A trigram GIN index over a few thousand rows answers in milliseconds;
  the operational cost of running and keeping a second datastore in sync with Postgres (reindexing on every
  dish/restaurant edit) isn't justified yet.
- **Postgres already has the tooling in this codebase.** `pg_trgm` fuzzy matching is an established,
  understood pattern here (ingredient suggestion, FDC matching) - reusing it is strictly less new surface
  area than introducing a second query engine and a sync pipeline to keep it current.

## Consequences

- Search quality is bounded by what `pg_trgm`/Postgres full-text search can do - acceptable relevance
  ranking and typo tolerance, but not the language-aware stemming, faceting, or relevance tuning a dedicated
  engine would offer.
- If catalog scale grows substantially, or deployment infrastructure gets built out, this decision should be
  revisited - it is explicitly scale- and infrastructure-contingent, not a permanent architectural stance.
- Any future schema change that adds more indexed search fields follows the same `db-migration` skill
  workflow as this one (see the `db-migration` skill in `.claude/skills/`).
