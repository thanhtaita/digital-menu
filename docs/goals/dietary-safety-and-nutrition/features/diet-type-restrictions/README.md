# Feature: diet-type restrictions at the dish level

## What it does

Diners can set diet-type restrictions (vegan, vegetarian, pescatarian, halal, kosher, gluten_free,
dairy_free, nut_free) on their profile, same as allergy/dislike restrictions. Before this feature, those
diet restrictions were stored but never actually checked against any dish - they had no effect. Now each
dish is checked against the diner's diet restrictions the same way allergy/dislike restrictions already
work: a dish is **blocked** or **warned** if any of its ingredients is explicitly known to violate the
diner's diet type, using the same severity levels the diner chose when creating the restriction. An
ingredient with no recorded stance on a diet type is never treated as a violation (no signal, not "safe by
default" in a false-confidence sense - genuinely "unknown").

Restaurant admins and superadmins don't interact with the diner-facing check directly, but a superadmin
does review the LLM-proposed diet tags that feed it (`/app/meta/ingredients` → "Diet tag matches" card) -
mirrors the existing FDC-match review queue UI pattern (see
[`../fdc-nutrition-backfill/README.md`](../fdc-nutrition-backfill/README.md)).

## Entry points in code

- `apps/diner-app/src/lib/restriction-engine.ts` - `getDishStatus`/`getMatchingRestrictions`, the actual
  dish-level check diners see rendered as badges.
- `apps/api/src/services/diet-tagging.ts` - LLM-assisted per-diet-type compatibility judgments via the
  existing AI provider abstraction (`lib/ai/`).
- `apps/api/src/scripts/backfill-diet-tags.ts` (`pnpm --filter @digital-menu/api backfill:diet-tags`) -
  one-off backfill script; auto-accepts high-confidence tags, queues the rest for review.
- `apps/api/src/routes/ingredients.ts` - `GET/POST /ingredients/diet-candidates*` superadmin review
  queue routes.
- `apps/admin-portal/src/routes/meta-ingredients.tsx` - "Diet tag matches" review UI.
- `packages/db/src/schema/schema.ts` - `ingredients.dietTags` (jsonb per-diet compatibility map),
  `ingredientDietCandidates` (review queue table), migration `0011`.
- `packages/shared/src/diet-tagging.ts` - shared `DietType`/`DietTagConfidence` types and the diet-type
  enum.

## See also

- [`design.md`](./design.md) - how the LLM tagging/review pipeline and the dish-level check work
- [`task-log.md`](./task-log.md) - chronological history
- [`docs/architecture/known-gaps.md`](../../../../architecture/known-gaps.md) - diet-tag coverage caveat
  (untagged ingredients contribute no signal)
