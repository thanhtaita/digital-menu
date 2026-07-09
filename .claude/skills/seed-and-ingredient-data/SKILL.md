---
name: seed-and-ingredient-data
description: Seed script order and fixture format, plus the ingredient dictionary's i18n design (aliases vs translations) and the proposed translation pipeline. Use when running/editing packages/seed scripts, working on ingredients/aliases/translations, or picking up the ingredient translation pipeline.
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
