-- Smoke-test queries for the fdc schema (2026-04-30 multi-source export:
-- Foundation Foods + SR Legacy + Survey/FNDDS, Branded Foods excluded - see
-- schema.sql), shaped like the API calls apps/api would actually make once
-- ingredients.fdc_id starts getting populated. Run any of these directly in
-- psql/a DB GUI, or via `python smoke_test.py` in this directory to see them
-- all execute.

-- 1. Ingredient search-as-you-type (e.g. GET /ingredients/search?q=tomato)
SELECT fdc_id, description, data_type
FROM fdc.food
WHERE description ILIKE '%lemon%'
ORDER BY description
LIMIT 10;

-- 2. Full nutrition panel for one food (e.g. GET /ingredients/:fdcId/nutrients)
SELECT n.name AS nutrient, fn.amount, n.unit_name
FROM fdc.food_nutrient fn
JOIN fdc.nutrient n ON n.id = fn.nutrient_id
WHERE fn.fdc_id = 747997
ORDER BY n.rank NULLS LAST;

-- 3. Core macros pivoted into one row per food (e.g. embedded in a dish detail response)
SELECT
  f.fdc_id,
  f.description,
  MAX(fn.amount) FILTER (WHERE fn.nutrient_id = 1008) AS kcal,
  MAX(fn.amount) FILTER (WHERE fn.nutrient_id = 1003) AS protein_g,
  MAX(fn.amount) FILTER (WHERE fn.nutrient_id = 1004) AS fat_g,
  MAX(fn.amount) FILTER (WHERE fn.nutrient_id = 1005) AS carbs_g,
  MAX(fn.amount) FILTER (WHERE fn.nutrient_id = 1093) AS sodium_mg
FROM fdc.food f
JOIN fdc.food_nutrient fn ON fn.fdc_id = f.fdc_id
WHERE f.fdc_id = ANY (ARRAY[747997, 323294])
GROUP BY f.fdc_id, f.description;

-- 4. Household portion/serving sizes (e.g. "1 cup diced" -> grams, for a serving-size picker)
SELECT fp.amount, mu.name AS unit, fp.portion_description, fp.gram_weight
FROM fdc.food_portion fp
JOIN fdc.measure_unit mu ON mu.id = fp.measure_unit_id
WHERE fp.fdc_id = 321358;

-- 5. Food-category facets (e.g. filter counts for a "browse ingredients" sidebar)
SELECT fc.description AS category, COUNT(*) AS food_count
FROM fdc.food f
JOIN fdc.food_category fc ON fc.id = f.food_category_id
GROUP BY fc.description
ORDER BY food_count DESC
LIMIT 10;

-- 6. Cross-schema match: candidate fdc_id for each app ingredient that doesn't have one yet
-- (this is what a "backfill ingredients.fdc_id" admin job would run)
SELECT i.id AS ingredient_id, i.canonical_name, f.fdc_id, f.description
FROM public.ingredients i
JOIN fdc.food f ON f.description ILIKE '%' || i.canonical_name || '%'
WHERE i.fdc_id IS NULL
ORDER BY i.canonical_name
LIMIT 15;

-- 7. Data-quality check: confirm the known referential gaps documented in schema.sql
-- haven't silently grown (would indicate a bad reload). load.py filters
-- food_nutrient_conversion_factor and sub_sample_result against the same
-- allowed-id sets used to populate their parent tables, so both orphan counts
-- are expected to be 0 by construction now - a non-zero result here means the
-- loader's filtering logic broke, not just a pre-existing USDA export gap.
SELECT
  (SELECT COUNT(*) FROM fdc.food_nutrient_conversion_factor c
     WHERE NOT EXISTS (SELECT 1 FROM fdc.food f WHERE f.fdc_id = c.fdc_id)) AS orphan_conversion_factor_fdc,
  (SELECT COUNT(*) FROM fdc.food_nutrient fn
     WHERE NOT EXISTS (SELECT 1 FROM fdc.nutrient n WHERE n.id = fn.nutrient_id)) AS orphan_food_nutrient_nutrient,
  (SELECT COUNT(*) FROM fdc.sub_sample_result r
     WHERE NOT EXISTS (SELECT 1 FROM fdc.food_nutrient fn WHERE fn.id = r.food_nutrient_id)) AS orphan_sub_sample_result;

-- 8. Cross-source search: confirm matches now span multiple data_types
-- (foundation_food, sr_legacy_food, survey_fndds_food), not just Foundation -
-- this is the whole point of the multi-source migration.
SELECT fdc_id, data_type, description
FROM fdc.food
WHERE description ILIKE '%chicken breast%'
ORDER BY data_type, description
LIMIT 20;

-- 9. Branded-exclusion check: should always return 0 - confirms no branded_food
-- rows (or rows that only existed to support them) leaked into the load.
SELECT COUNT(*) AS branded_rows_present
FROM fdc.food
WHERE data_type = 'branded_food';
