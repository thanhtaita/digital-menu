# Design: diet-type restrictions at the dish level

## Data model

`ingredients.dietTags` is a jsonb map from diet type → boolean compatibility (`true` = compatible,
`false` = violates, key absent = no known signal), added in migration `0011` alongside a mirror review
table `ingredient_diet_candidates` (ingredient, diet type, proposed compatibility, confidence, reasoning,
`pending`/`accepted`/`rejected` status) - structurally the same shape as `ingredient_fdc_candidates` from
the earlier FDC nutrition backfill (see
[`../fdc-nutrition-backfill/design.md`](../fdc-nutrition-backfill/design.md)), reused deliberately so the
review-queue pattern (propose → auto-accept high confidence → queue the rest → superadmin accept/reject)
didn't have to be reinvented.

## Tagging pipeline

`services/diet-tagging.ts` sends a single ingredient's canonical name (+ optional description) to the
existing AI provider abstraction (`lib/ai/`) with a system prompt asking it to judge compatibility against
each of the 8 supported diet types independently, each with its own confidence (`high`/`medium`/`low`) and
one-sentence reasoning. The prompt explicitly tells the model to omit diet types it's genuinely unsure
about (e.g. "broth" without knowing the base) rather than guess - the array response can have fewer than 8
entries per ingredient.

`backfill-diet-tags.ts` runs this over the ingredient dictionary; results at `AUTO_ACCEPT_CONFIDENCE`
("high") are merged straight into `ingredients.dietTags` via `applyDietTag`, everything else lands in
`ingredient_diet_candidates` as `pending` for a superadmin to accept or reject through
`/ingredients/diet-candidates*` and the admin-portal review card.

## Dish-level check

`restriction-engine.ts`'s `violatesDiet(ingredient, dietType)` returns `true` only when
`ingredient.dietTags?.[dietType] === false` - an explicit, strict equality check. This means both "key
absent" (`undefined`) and "explicitly compatible" (`true`) fall through to "not a violation." That
asymmetry is deliberate: an untagged ingredient must never accidentally block a dish just because the
tagging pipeline hasn't reached it yet (see the coverage caveat in
[`docs/architecture/known-gaps.md`](../../../../architecture/known-gaps.md)) - false negatives (missing a
real violation) are considered less harmful than false positives (blocking a dish a diner could actually
eat) at this stage, matching how the pre-existing allergy/dislike check already only matches on explicit
ingredient IDs rather than inferring anything.

Once any ingredient on a dish violates the diner's diet type, the dish's status follows the restriction's
own severity (`block` → dish status `blocked`; `warn` → dish status `warn`), reusing the exact same
severity semantics `getDishStatus` already applied to allergy/dislike restrictions - no new severity
concept was introduced for diet.

## Known limitation / tradeoff

This environment had no reachable Postgres when the feature was built, so `drizzle:migrate` could not be
run/verified against a live DB (`drizzle:generate` did run and produced a clean, minimal diff). The
service and route logic were verified via unit/route tests with a mocked db layer instead - the same
limitation noted on the earlier FDC nutrition backfill commit.
