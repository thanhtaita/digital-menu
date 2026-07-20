## 2026-07-11 20:59 — Backfill ingredient nutrition data from USDA FoodData Central

**Commit:** a89bde8

Added `services/fdc-matching.ts` (pg_trgm fuzzy match against `fdc.food`), the `backfill:fdc` script,
`ingredients.fdcId`/`nutrients` columns (migration `0010`), an `ingredient_fdc_candidates` review queue,
superadmin routes/UI, and sodium in the diner-app `NutritionPills`. Nutrients are denormalized into
`ingredients.nutrients` jsonb at accept time, not joined live.

## 2026-07-11 20:26 — add fdc data

**Commit:** ee68ba6

Loaded the USDA FoodData Central "Foundation Foods" CSV export (2025-12-18, 24 tables, ~600k rows) plus
import tooling (`schema.sql`, `load.py`, smoke tests) into `resources/FoodData_Central_foundation_food_csv_2025-12-18/`
- the raw reference data the same-day backfill feature above depends on.
