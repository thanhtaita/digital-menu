# Feature: platform-wide search

## What it does

A diner can search from anywhere in the diner app - not just while browsing one restaurant's menu - and get
matching restaurants and dishes across the whole catalog. Dish matches search dish name, dish description,
and matching ingredient canonical names (only ingredients that are visible on that dish - approved and not
hidden); restaurant matches search restaurant name and description. Every result respects the same
visibility rules as the rest of the public API: only active restaurants, and only dishes on a published menu
of an active restaurant, can ever appear.

## Entry points in code

- `apps/api/src/services/search.ts` - `searchCatalog(query)`, the `pg_trgm`-based query logic (see
  [`design.md`](./design.md) for the query shape and the visibility-filtering requirement).
- `apps/api/src/routes/public-menu.ts` - `GET /public/search?q=` (public, no auth, rate-limited via
  `SEARCH_RATE_LIMIT`).
- `packages/shared/src/public-menu.ts` - `publicSearchResponseSchema`, `publicSearchDishSchema`.
- `packages/db/src/schema/schema.ts` - trigram GIN indexes on `dishes.name`/`description` and
  `restaurants.name`/`description` (migration `0012`).
- `apps/diner-app/src/components/search-box.tsx` - the search input, rendered in `SiteHeader` (present on
  most pages) and on the homepage (`apps/diner-app/src/app/page.tsx`, which doesn't use `SiteHeader`).
- `apps/diner-app/src/app/search/page.tsx` - the results page (`/search?q=`), grouped into Restaurants and
  Dishes; each dish result links into that restaurant's menu page at `#dish-{id}`.

## See also

- [`design.md`](./design.md) - the Postgres-vs-dedicated-engine call
  ([`ADR-003`](../../../../decisions/ADR-003-postgres-search-not-dedicated-engine.md)), the query/index
  approach, and the visibility-filtering requirement.
- [`task-log.md`](./task-log.md) - chronological history.
