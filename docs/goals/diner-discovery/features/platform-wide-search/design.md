# Design: platform-wide search

## Staying in Postgres

See [`ADR-003`](../../../../decisions/ADR-003-postgres-search-not-dedicated-engine.md) for the full
rationale: no dedicated search engine (OpenSearch/Elasticsearch/Meilisearch), because there's no deployment
infrastructure to host one on yet and the current catalog scale doesn't need one. Everything below runs as
plain SQL against the existing Postgres database.

## Query technique: `pg_trgm`, matching the existing pattern

`apps/api/src/services/search.ts` extends the same `pg_trgm` `similarity()` fuzzy-match technique already
used by `apps/api/src/services/ai-ingredient-suggestion.ts` and `apps/api/src/services/fdc-matching.ts`,
rather than introducing Postgres full-text search (`tsvector`/`websearch_to_tsquery`) as a second technique.
Each search query (restaurants, dishes) combines two conditions per matched field:

- `ILIKE '%q%'` - exact substring match, always reliable regardless of trigram score.
- `similarity(field, q) > SEARCH_SIMILARITY_THRESHOLD` (default `0.3`, matching Postgres' own
  `pg_trgm.similarity_threshold` default) - fuzzy/typo-tolerant match, e.g. `"bruschetaa"` still finds
  `"Bruschetta al Pomodoro"`.

Results are ordered by `greatest(...)` over the per-field similarity scores, so the closest match ranks
first even though the `WHERE` clause is an `OR` across substring and fuzzy conditions.

Unlike the older `ai-ingredient-suggestion.ts`/`fdc-matching.ts` usages (which predate any migration
actually enabling the extension, and so wrap `similarity()` calls in a try/catch that silently no-ops if
`pg_trgm` isn't installed - see `docs/architecture/known-gaps.md`), this feature's migration (`0012`)
explicitly runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` before creating its indexes, so no defensive
fallback is needed here - the extension is guaranteed present once `0012` has been applied.

## Schema/index approach

Migration `0012` adds four trigram GIN indexes (`packages/db/src/schema/schema.ts`):

- `dishes_name_trgm`, `dishes_description_trgm`
- `restaurants_name_trgm`, `restaurants_description_trgm`

declared via `index(...).using("gin", table.column.op("gin_trgm_ops"))`. Ingredient canonical-name matching
deliberately reuses the ingredient dictionary's existing lookup path (no new index on `ingredients`) - it's
a small, already-indexed table (unique btree on `canonical_name`), and the join from dish to ingredient is
already bounded by `dish_ingredients` per dish.

**One hand-added line in the generated migration.** `drizzle-kit generate` produced the four `CREATE INDEX
... USING gin (... gin_trgm_ops)` statements correctly, but did not add `CREATE EXTENSION IF NOT EXISTS
pg_trgm` - unlike the `vector` type (used by the embeddings migration, `0006`), which drizzle-kit recognizes
natively and auto-emits `CREATE EXTENSION vector` for, there's no equivalent first-class "this needs an
extension" declaration for a `gin_trgm_ops` index. The line was added by hand to `packages/db/drizzle/0012_nebulous_vampiro.sql` as a narrow, deliberate exception to "never hand-write migration SQL" - the
same category of justified exception as the `0009` incident described in the `db-migration` skill, just
smaller (one idempotent `CREATE EXTENSION IF NOT EXISTS` line, not a hand-corrected diff).

## The visibility-filtering requirement

This is the one correctness requirement with real data-leak risk if it's ever weakened: **search must never
surface a restaurant that isn't active, or a dish that isn't on a published menu of an active restaurant.**
`searchCatalog()` in `apps/api/src/services/search.ts` enforces this by construction, not as an
after-the-fact filter:

- Restaurant search: `WHERE is_active = true` directly on `restaurants`.
- Dish search: the `FROM dishes` query `JOIN`s through `menu_sections → menus (is_published = true) →
  restaurants (is_active = true)` - a dish with no path through a published menu of an active restaurant
  simply never appears in the joined row set, regardless of how well its name/description/ingredients match
  the query.
- Ingredient matches (`EXISTS (...)` subquery against `dish_ingredients`/`ingredients`) additionally require
  `dish_ingredients.is_hidden = false` and `ingredients.approval_status = 'approved'` - the same ingredient
  visibility filter `GET /public/restaurants/:slug/menu` already applies when building a dish's ingredient
  list (`public-menu.ts`).

This exactly mirrors the two visibility filters the existing public endpoints already use
(`eq(restaurants.isActive, true)` in `GET /public/restaurants`; `eq(menus.isPublished, true)` +
`eq(restaurants.isActive, true)` in `GET /public/restaurants/:slug/menu`) - no new visibility rule was
invented for search.

Verified locally by seeding an inactive restaurant with a published menu/dish, and a separate active
restaurant with an unpublished menu/dish, both using a distinctive matchable name/description - neither
appeared in search results for that distinctive term, while an equivalent visible dish did.

## Response shape

`packages/shared/src/public-menu.ts` adds `publicSearchResponseSchema` / `publicSearchDishSchema` next to
the existing `publicDishSchema`/`publicRestaurantListItemSchema`, reusing the same field names/types
(`price` as a string, nullable `description`/`imageUrl`, etc.) rather than inventing new conventions.
Restaurant results reuse `publicRestaurantListItemSchema` directly (no duplication needed - a search
restaurant result is the same shape as a restaurant-list-page result). Dish results are a trimmed version of
`publicDishSchema` (no `media`/`ingredients` arrays, no `displayOrder`) plus a `restaurant: { id, slug, name
}` field so a search result row can link straight into that restaurant's menu without a second request.

## Frontend

- `apps/diner-app/src/components/search-box.tsx` is a plain `<form method="GET" action="/search">` - works
  without JavaScript, matches the "keep it simple" scope (no autocomplete/faceted filters/pagination).
- Rendered in `SiteHeader` (present on most pages, giving "search from anywhere") and separately on the
  homepage (`apps/diner-app/src/app/page.tsx`), which has its own masthead and doesn't render `SiteHeader`.
- `apps/diner-app/src/app/search/page.tsx` is a server component reading `searchParams.q`, matching the
  existing `fetchPublicMenu`/`fetchPublicRestaurants` pattern in `apps/diner-app/src/lib/public-menu.ts`
  (new `fetchPublicSearch`). Queries under 2 characters skip the API call and show a prompt instead.
- Dish thumbnails use `DishGradient` (not real photos) - matching how the existing menu page renders dish
  thumbnails today (see `apps/diner-app/src/app/r/[slug]/menu-with-modal.tsx`, which also always uses
  `DishGradient` rather than a resolved `imageUrl`). The gradient-vs-real-photo gap from
  `data/diner-scout-x3/report.md` is a separate, out-of-scope task - this feature stays consistent with the
  existing behavior rather than fixing it incidentally.
