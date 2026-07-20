## 2026-07-12 17:36 — Apply diet-type restrictions at the dish level

**Commit:** cc11119

Added `ingredients.dietTags` (jsonb, migration `0011`) plus an LLM-assisted tagging pipeline
(`services/diet-tagging.ts`, `backfill:diet-tags` script, `ingredient_diet_candidates` review queue,
superadmin routes/UI) mirroring the earlier FDC nutrition backfill. `restriction-engine.ts` now actually
checks diet-type restrictions against dish ingredients (missing tag = no signal, never a violation);
previously diet restrictions were stored per-user but silently ignored at the dish level.
