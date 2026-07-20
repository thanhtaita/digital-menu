# Feature: FDC nutrition backfill

## What it does

Ingredients in the shared dictionary can now carry real nutrition data (calories, protein, fat, carbs,
sodium per 100g) sourced from the USDA FoodData Central export (Foundation Foods + SR Legacy +
Survey/FNDDS, Branded Foods excluded), instead of showing nothing. Diners already saw a nutrient panel in
the ingredient bottom-sheet when data was present; this feature is what actually populates that data for
most ingredients, and extends the panel to also show sodium. Ambiguous matches (fuzzy name-matching can be
wrong) go to a superadmin review queue rather than being applied blindly - `/app/meta/ingredients` → "FDC
nutrition matches" card - so the diner-facing data stays trustworthy. The review queue also captures the
matched `fdc_data_type` so a reviewer can tell which source (Foundation/SR Legacy/Survey) a candidate match
came from.

This includes the *raw reference data itself*: the USDA export that this feature's matching service
queries. See [`docs/architecture/fdc-reference-data.md`](../../../../architecture/fdc-reference-data.md)
for the reference schema; this feature doc covers only the backfill/matching layer on top of it.

## Entry points in code

- `apps/api/src/services/fdc-matching.ts` - `findFdcCandidates` (pg_trgm fuzzy match against
  `fdc.food.description`), `fetchFdcNutrients` (fixed macro set fetch), `applyFdcMatch`.
- `apps/api/src/scripts/backfill-fdc-nutrients.ts` (`pnpm --filter @digital-menu/api backfill:fdc`) -
  one-off backfill script; auto-accepts high-confidence matches, queues the rest for review.
- `apps/api/src/routes/ingredients.ts` - `GET/POST /ingredients/fdc-candidates*` superadmin review
  queue routes.
- `apps/admin-portal/src/routes/meta-ingredients.tsx` - "FDC nutrition matches" review UI.
- `packages/db/src/schema/schema.ts` - `ingredients.fdcId`/`foodCategory`/`nutrients` (jsonb),
  `ingredientFdcCandidates` (review queue table, `fdcDataType` column captures the matched source).
- `packages/shared/src/fdc.ts` - `FDC_NUTRIENT_IDS` fixed macro-to-nutrient-id map, `IngredientNutrients`
  type.
- `apps/diner-app/src/components/atoms.tsx` - `NutritionPills`, extended to render sodium.
- `resources/fdc-data/import/` - the raw CSV data + `load.py` import tooling this feature's matching
  queries depend on being loaded first.

## See also

- [`design.md`](./design.md) - matching thresholds, denormalization approach, tradeoffs
- [`task-log.md`](./task-log.md) - chronological history
- [`docs/architecture/fdc-reference-data.md`](../../../../architecture/fdc-reference-data.md) - the `fdc`
  reference schema itself
