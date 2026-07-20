# Goal: dietary safety and nutrition

## What this is

Diners come to the platform with allergies, dislikes, and diet types (vegan, halal, gluten-free, etc.).
This goal covers everything that turns the shared, global ingredient dictionary into something that can
actually warn or block on those restrictions, plus giving diners real nutritional information instead of
just a dish description - both by enriching `ingredients` with structured data (nutrients, diet
compatibility) and by wiring the restaurant-facing review workflows that keep that enrichment trustworthy
(superadmin review queues rather than blind LLM auto-tagging of everything).

## Why it matters

The project goal (see [`docs/index.md`](../../index.md)) explicitly promises diners "allergy/diet-aware
warnings." Allergy/dislike matching by ingredient ID existed earlier, but diet-type restrictions were
stored on user profiles and silently ignored at the dish level until the `diet-type-restrictions` feature
below shipped - diners could set a diet restriction that did nothing. Nutrition data (`fdc-nutrition-backfill`)
is the other half: diners can't make informed choices without knowing what's actually in a dish.

## Status

Both features below are shipped. Diet-tag and FDC-match coverage across the ingredient dictionary is
partial and grows only as the backfill scripts are (re)run and superadmins clear their review queues - see
[`docs/architecture/known-gaps.md`](../../architecture/known-gaps.md) for the current coverage caveat.

## Features

- [`features/diet-type-restrictions/`](./features/diet-type-restrictions/README.md) - applies per-diet
  ingredient compatibility to dish-level allergy/diet warnings and blocks.
- [`features/fdc-nutrition-backfill/`](./features/fdc-nutrition-backfill/README.md) - backfills
  `ingredients.nutrients`/`fdcId` from the USDA FoodData Central reference schema.

Earlier ingredient-dictionary work (the global dictionary itself, approval workflow, translations,
aliases, AI ingredient suggestions) predates this docs system and is not backfilled here - see the
`seed-and-ingredient-data` skill and `CLAUDE.md` for its current state.
