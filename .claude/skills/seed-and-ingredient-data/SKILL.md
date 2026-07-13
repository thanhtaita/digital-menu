---
name: seed-and-ingredient-data
description: Seed script order and fixture format, the ingredient dictionary's i18n design (aliases vs translations), the FDC nutrition backfill (matching, review queue, diner-facing rendering), and the proposed translation pipeline. Use when running/editing packages/seed scripts, working on ingredients/aliases/translations/nutrients, or picking up the ingredient translation pipeline.
---

# Seed scripts and ingredient data model

## Seed script order (matters)

`packages/seed` has two independent scripts that **must run in this order**:

1. **`pnpm --filter @digital-menu/seed seed`** → runs `seed-test-data.ts`. Seeds the **global ingredient dictionary**: ~44 hardcoded ingredients (the 9 FDA major allergens - milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame - plus common cooking ingredients, plus several ingredients specific to the "Polar Palate" AI-test menu: durian, coconut milk, chili pepper, liver, tripe, octopus, etc.). Each entry has `canonicalName`, `slug`, `description`, allergen flags/group, and a list of aliases. Upserts via `onConflictDoUpdate` on `slug`.
2. **`pnpm --filter @digital-menu/seed seed:menus`** → runs `seed-menu-data.ts`. Seeds restaurants, menus, sections, and dishes from JSON fixtures at `packages/seed/data/menu-seed.json` and `packages/seed/data/ai-test-menu-seed.json`. **Depends on ingredients already existing** - it builds a `slugToId` map from the dictionary and throws if it's empty, instructing you to run `seed` first. Dishes reference ingredients **by slug**, not by hardcoded ID.

For each restaurant bundle, `seed-menu-data.ts` upserts: owner user (bcrypt-hashed password, default role `restaurant_admin`) → restaurant → `restaurant_admins` link → menus → sections → dishes, replacing `dish_media`, `dish_ingredients` (mapped via ingredient slug → id), and `dish_translations` (via `upsertDishTranslations`, keyed on `dishId` + `locale`) for each dish.

`packages/seed/data/*.json` fixtures are hand-authored, not DB dumps: a `RestaurantBundle[]` shape (owner + restaurant + menus[] with nested sections/dishes/media/ingredients/translations). `menu-seed.json` is the general sample restaurant ("Bella Cucina"); `ai-test-menu-seed.json` is "Polar Palate" - 15 deliberately polarizing dishes built to exercise the AI chat/recommendation feature.

## The two i18n mechanisms (not unified - don't assume they are)

The schema has two genuinely different localization mechanisms that serve different purposes:

1. **`ingredient_aliases`** (`ingredientId`, `alias`, `languageCode` default `"en"`, unique on `(ingredientId, alias)`) - informal, used for **fuzzy alias matching/search** (e.g. matching "dairy" to milk). This is the older, lighter-weight mechanism.
   - **Known rough edge**: `packages/seed/src/seed-test-data.ts` currently tags some non-English aliases (French "lait"/"œuf"/"beurre"/"fromage", Italian) with `languageCode: "en"` regardless of their actual language. This is a seed-data bug worth fixing if you're touching that file, but it's not a schema limitation.
2. **`dish_translations` / `ingredient_translations`** (migration `0005_translations`) - formal, BCP-47 locale-keyed overlay tables (`dishId`/`ingredientId` + `locale` + `name`/`description`, unique per locale) used for **display localization**. The root table (`dishes.name`/`ingredients.canonicalName`) holds the source-language (English) fallback; translations are overlays per locale. This is what the admin portal's "Translations" panels read/write today.

Neither mechanism talks to the other. A translation added via `dish_translations` does not affect alias-based search, and vice versa.

## FDC nutrition backfill (implemented)

`ingredients.nutrients` (jsonb) is populated by matching against the read-only `fdc` Postgres schema
(USDA FoodData Central, multi-source - Foundation Foods + SR Legacy + Survey/FNDDS, Branded Foods
deliberately excluded - loaded per `CLAUDE.md`'s "Reference data" section - `resources/fdc-data/import/schema.sql`
+ `load.py`). `fdc.*` is never queried live at request time - values are denormalized into
`ingredients.nutrients`/`fdc_id`/`food_category` once, at backfill/accept time.

- **Matching service**: `apps/api/src/services/fdc-matching.ts` - `findFdcCandidates(canonicalName)` fuzzy-matches
  `fdc.food.description` via `pg_trgm` `similarity()` (same approach as
  `apps/api/src/services/ai-ingredient-suggestion.ts`'s ingredient fuzzy match, reused rather than
  reinvented). `fdc.food` spans every loaded source with no `data_type` filter in this query, so a
  match can come from Foundation, SR Legacy, or Survey/FNDDS - the returned/queued candidate carries
  `dataType`/`fdcDataType` (from `fdc.food.data_type`) so a reviewer can tell which source it came
  from. Two thresholds, both env-overridable: `FDC_MATCH_CANDIDATE_THRESHOLD` (default `0.35`,
  below this a name isn't queued at all) and `FDC_MATCH_AUTO_ACCEPT_THRESHOLD` (default `0.7`, at/above
  this the backfill script applies the match without review).
- **Fixed nutrient set**: `FDC_NUTRIENT_IDS` in `packages/shared/src/fdc.ts` - `cal`(1008), `protein`(1003),
  `fat`(1004), `carbs`(1005), `sodium`(1093). Deliberately a small fixed set, not "whatever fdc has" -
  extend by adding a key here + a matching pill in `apps/diner-app/src/components/atoms.tsx`'s
  `NutritionPills`, not by reading arbitrary nutrient_ids ad hoc.
- **Backfill script**: `pnpm --filter @digital-menu/api backfill:fdc` (`apps/api/src/scripts/backfill-fdc-nutrients.ts`).
  For every `ingredients` row with `fdc_id IS NULL`: auto-accepts the top candidate above the auto-accept
  threshold (writes `fdc_id`/`nutrients`/`food_category` directly); queues everything else in
  `ingredient_fdc_candidates` (migration `0010`) for manual review; leaves ingredients with no candidate
  above the floor threshold alone (`fdc_id: null`, empty `nutrients` - expected for exotic/restaurant-specific
  ingredients with no FDC equivalent, not an error). Idempotent: already-matched ingredients are skipped,
  and the `(ingredient_id, fdc_id)` unique index makes re-queueing a no-op.
- **Review workflow**: modeled on the existing ingredient-approval pattern (`/ingredients/pending` +
  `/ingredients/:id/approve` in `apps/api/src/routes/ingredients.ts`). `GET /ingredients/fdc-candidates`,
  `POST /ingredients/fdc-candidates/:id/accept`, `POST /ingredients/fdc-candidates/:id/reject` (all
  superadmin-only; see the `api-routes` skill). Accepting calls the same `applyFdcMatch()` the backfill
  script uses, and also auto-rejects any other pending candidates queued for that ingredient (only one
  fdc_id can be accepted per ingredient). `ingredient_fdc_candidates.fdcDataType` (migration `0012`,
  nullable - candidates queued before this column existed have none) carries the source `data_type` for
  each candidate. Admin-portal UI: the "FDC nutrition matches" card in `/app/meta/ingredients`
  (`apps/admin-portal/src/routes/meta-ingredients.tsx`), styled after the existing pending-ingredient-requests
  card, with a small source badge ("Foundation" / "SR Legacy" / "Survey (FNDDS)") next to each candidate.
  Clicking a row (not the Accept/Reject buttons themselves) opens `FdcCandidateDetailDialog`
  (`apps/admin-portal/src/components/fdc-candidate-detail-dialog.tsx`), a two-pane modal fetched via
  `GET /ingredients/fdc-candidates/:id/detail` - left pane is the full `ingredients` row (description,
  allergen flags, aliases, media, any nutrients already saved), right pane is the full `fdc.*` record
  (description, source, food category, household portions, and the **complete** nutrient panel - every
  `fdc.food_nutrient` row for that `fdc_id`, not just the fixed `FDC_NUTRIENT_IDS` set denormalized onto
  `ingredients.nutrients`). `fetchFdcFullDetail()` in `fdc-matching.ts` is the query for that full panel;
  it's only ever called on-demand for one candidate at a time, unlike the per-ingredient backfill path, so
  the wider join is fine. The dialog's own Accept/Reject buttons reuse the same mutations as the row's.
- **Diner-facing read path**: already wired before this work - `apps/api/src/routes/public-menu.ts` selects
  `ingredients.nutrients` into the public menu response, and `apps/diner-app`'s ingredient bottom-sheet modal
  (`apps/diner-app/src/app/r/[slug]/menu-with-modal.tsx`) renders it via `NutritionPills`, which degrades to
  rendering nothing (not an error) when `nutrients` is null/empty. The backfill only had to make sure that
  slot actually gets populated data.

## Proposed next iteration: ingredient translation pipeline (not yet built)

This section is design rationale for future work, absorbed from a design plan (`plans/260628_ingredient_translation_pipeline_design_plan.txt`, now merged here and deleted as a standalone file). **None of this exists in `schema.ts` today** - no `translation_jobs`, `ingredient_nutrition`, `is_human_reviewed`, or `ingredient_translation_history` tables. Treat it as aspirational unless a task explicitly asks you to build it.

### Is the ingredient entity design right?

Yes - ingredient-as-canonical-entity is correct, but it's doing multiple jobs (hyperlink/search, multilingual display, macro-nutrient calculation, dish relationships) and each job needs its own table. **The canonical ingredient is the source of truth; translations, nutrition, and aliases all hang off it - never flatten them into one table** (e.g. don't add `name_ja`/`name_fr` columns directly on `ingredients`; that requires an `ALTER TABLE` per new language).

### Proposed schema additions

```
ingredient_translations (already exists, simpler than proposed below)
  - would gain: is_human_reviewed (boolean) - required for allergen safety and high-traffic languages

ingredient_nutrition (does not exist - nutrients currently live as a jsonb column on `ingredients`)
  - ingredient_id, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g, source

translation_jobs (does not exist)
  - id, ingredient_id, trigger ("new_ingredient" | "name_changed" | "description_changed"),
    status ("pending" | "in_progress" | "done" | "failed"), target_languages, created_at

ingredient_translation_history (does not exist)
  - ingredient_id, language_code, translated_name, replaced_at  — versioning/rollback for translations
```

### Translation update strategy (proposed)

1. **Track what needs translation** - every ingredient create/name-change/description-change writes a `translation_jobs` row (audit trail, retryable).
2. **AI as first pass** - an LLM or translation API generates translations for all target languages, written with `is_human_reviewed = false`. Users always see something machine-translated rather than a blank.
3. **Flag for human review on sensitive changes** - required when the ingredient is a common allergen (mistranslation is a safety issue), the canonical name changed significantly, or the target language is high-traffic (e.g. Japanese, French, Arabic, Chinese).
4. **Version translations, don't overwrite** - archive the old translation to `ingredient_translation_history` before replacing it, for rollback/audit.
5. **Batch vs. real-time** - new ingredient → translate immediately; bulk import → batch overnight; minor typo fix with no real meaning change → skip retranslation (use a dirty flag / hash comparison).

### The one rule to get right early

**Define English as the canonical language and never translate from a translation.** All translation jobs must originate from the English canonical record. Letting `name_fr` be the source for `name_ja` introduces translation drift that compounds over time - this is foundational, not a style preference.
