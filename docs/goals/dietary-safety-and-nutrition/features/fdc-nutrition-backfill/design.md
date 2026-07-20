# Design: FDC nutrition backfill

## Matching approach

`findFdcCandidates` fuzzy-matches an ingredient's `canonicalName` against `fdc.food.description` using
Postgres `pg_trgm` `similarity()` - the same technique already used by the AI ingredient suggestion
feature (see the `recommendation-embeddings` skill), reused deliberately rather than introducing a second
matching strategy. Two tunable thresholds (env-overridable, inline-default style per
`CLAUDE.md`/`AGENTS.md` conventions):

- `FDC_MATCH_CANDIDATE_THRESHOLD` (default `0.35`) - below this similarity score, a name isn't even worth
  queueing for review.
- `FDC_MATCH_AUTO_ACCEPT_THRESHOLD` (default `0.7`) - above this, the backfill script sets
  `ingredients.fdcId` directly with no human review; between the two thresholds, the match is queued in
  `ingredient_fdc_candidates` for a superadmin to accept or reject.

If the `fdc` schema isn't loaded (or `pg_trgm` is unavailable), `findFdcCandidates` catches the query
failure and returns no candidates rather than erroring - matches the project-wide convention of skipping
`pg_trgm`-dependent features silently rather than failing loudly (see
[`docs/architecture/known-gaps.md`](../../../../architecture/known-gaps.md)).

## Denormalization, not a live join

`fetchFdcNutrients` pulls a **fixed** macro set (calories, protein, fat, carbs, sodium - defined once in
`FDC_NUTRIENT_IDS`) for a matched `fdc_id` and writes it into `ingredients.nutrients` jsonb at accept time.
There is no live join to `fdc.*` at request time - once accepted, nutrient values are a point-in-time copy,
not a reference. This trades staleness risk (if the `fdc` schema were ever reloaded with updated USDA data,
already-accepted ingredients wouldn't pick up changes automatically) for simplicity and request-time
performance - reading `ingredients.nutrients` needs no cross-schema join, matching how the rest of the
ingredient dictionary already denormalizes rather than joins.

## Review queue pattern

`ingredient_fdc_candidates` (ingredient, proposed `fdc_id`, description, similarity score,
`pending`/`accepted`/`rejected` status) is the same shape later reused for diet tags
(`ingredient_diet_candidates`, see
[`../diet-type-restrictions/design.md`](../diet-type-restrictions/design.md)) - this feature established
the propose → auto-accept-high-confidence → queue-the-rest → superadmin-review pattern that the diet-tag
feature then copied rather than inventing its own review-queue shape.

## Known limitation / tradeoff

This environment had no reachable Postgres/psycopg2, so neither the `fdc` schema load (`load.py`) nor the
backfill script itself could be run live when this feature was built - verified via unit/route tests with
a mocked db layer instead. Actual match quality/coverage against real data was not observed at build time.
