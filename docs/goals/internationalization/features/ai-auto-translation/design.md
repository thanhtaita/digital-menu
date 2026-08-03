# Design: AI auto-translation

This feature was scoped by a prior scout investigation (report + captain product decisions, not checked
into this repo) before implementation. This doc captures the decisions as shipped.

## Why a separate cache table, not a unified schema

Two options were on the table: (1) a new `ai_content_translations` cache table, disposable and separate
from the existing manual tables, or (2) a unified table with a `source: 'ai' | 'human'` column replacing
both manual tables. (1) was chosen - it touches none of the existing, live, tested manual-translation
feature or its migration history. The tradeoff: two parallel systems (manual overlay tables + AI cache)
instead of one. Worth revisiting only if the entity/field list grows enough that maintaining both becomes
its own burden.

## Precedence: human wins unconditionally

A row in `dish_translations`/`ingredient_translations` for a given locale is used as-is, with **no hash
check** - a human's translation isn't invalidated by a later source-text edit; that's a content-curation
decision for the human to notice and re-save. A later human edit "overriding" a cached AI translation
needs no extra mechanism: the moment a human `PUT`s a translation via the existing (unchanged) endpoint,
step 1 of resolution starts matching and the AI cache is simply never consulted again for that slot. If
the human later deletes their manual translation, resolution falls back to the AI cache automatically.

**Never chain translations.** Generation always regenerates from the source-language field on the root
`dishes`/`ingredients` row, never from another locale's translated text - `resolveEntityTranslations()` is
always called with the source text, never a previously-resolved value.

## Schema

```sql
CREATE TABLE ai_content_translations (
  id serial PRIMARY KEY,
  entity_type text NOT NULL,       -- 'dish' | 'ingredient'
  entity_id integer NOT NULL,
  field text NOT NULL,             -- 'name' | 'description' | 'allergen_group'
  locale text NOT NULL,
  source_hash text NOT NULL,       -- sha256 of the source-language text at generation time
  translated_value text NOT NULL,
  model text NOT NULL,
  generated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, field, locale)
);
```

No FK to `dishes`/`ingredients` - a deliberate tradeoff for a polymorphic association (Postgres can't FK
against "whichever table `entity_type` names"). Referential integrity is enforced at the application layer:
the read path only ever looks up entity IDs it already fetched from `dishes`/`ingredients` in the same
request. `entityType` is a plain string, not a Postgres enum, so extending coverage to `menu_section`/
`menu`/`restaurant` later is a pure application-code change, no migration required - not built now (see
"Deferred" below).

A stale-hash row is simply overwritten by the next successful generation (`INSERT ... ON CONFLICT ...
DO UPDATE` on the unique key), so "invalidate only the affected field/locale" falls out for free - no
explicit delete/wipe step is ever needed. Two concurrent diners triggering generation for the same missing
`(entity, field, locale)` at once both succeed harmlessly into the same upsert; not worth a distributed
lock at this traffic level.

## Model/provider choice

Reuses the existing Gemini channel (`apps/api/src/lib/ai/`) at `gemini-2.0-flash-lite` - the same model
already used for the `"suggestion"` (`ai-ingredient-suggestion.ts`) and `"summarize"` purposes. No new
provider, SDK, or API key. `AI_TRANSLATION_MODEL` env override follows the same convention as
`AI_SUGGESTION_MODEL`/`AI_DIET_TAG_MODEL`, so escalating to a stronger model later is a config change, not
a rewrite.

**Batching**: one `generateText()` call per entity+locale, translating all of that entity's fields
together (a dish's name+description in one call; an ingredient's name+description+allergen-group in one
call) - not one call per field, and not batched across a whole menu. This keeps failure blast-radius to
one entity in one locale per request, mirrors the existing `ai-ingredient-suggestion.ts`/`diet-tagging.ts`
pattern (JSON-only system prompt + hand-rolled `extractJson`-style extraction), and lets one bad field
fall back independently without blanking a good field from the same response.

## Locale allow-list (hard requirement)

`GET /public/restaurants/:slug/menu` has no auth. Once a `locale` parameter can trigger a paid LLM call,
an unauthenticated attacker could enumerate arbitrary BCP-47-shaped strings to force repeated generation
and run up spend. `isSupportedTranslationLocale()` (`apps/api/src/services/ai-translation.ts`) validates
the requested locale against a fixed allow-list *before* any DB lookup or generation attempt - an
unrecognized locale is treated identically to no locale at all (silent source-text fallback), and no
partial work (cache lookups, manual-translation queries) happens for it either.

Default allow-list (`SUPPORTED_TRANSLATION_LOCALES` in `packages/shared/src/translation.ts`, single source
of truth for both the API gate and the diner-app picker): Spanish (`es`), French (`fr`), German (`de`),
Italian (`it`), Portuguese (`pt`), Chinese Simplified (`zh-Hans`), Japanese (`ja`), Korean (`ko`),
Vietnamese (`vi`), Arabic (`ar`), Hindi (`hi`). English (`SOURCE_LOCALE`) is the source language and is
never in the list - requesting it (or no locale) always serves the root `dishes`/`ingredients` column
directly, skipping translation resolution entirely. Env-overridable via `TRANSLATION_LOCALES`
(comma-separated) on the API side, following the inline-default `process.env` convention already used in
`lib/ai/config.ts`.

## Failure handling

Every failure mode - generation timeout, provider error, malformed/unparseable model output, a field
missing from an otherwise-valid JSON response, a DB error on the cache lookup or upsert - falls back to
the source-language text for that request only. **No failure is ever written to the cache** (no
"generation failed" tombstone); a bare cache miss is self-describing and retries naturally on the next
request. `generateWithTimeout()` races the provider call against a ~2.5s timer
(`AI_TRANSLATION_TIMEOUT_MS`); the losing timer promise gets a no-op `.catch()` so it doesn't surface as
an unhandled rejection once the race has already resolved the other way.

Per-field fallback: one `generateText()` call translates multiple fields at once, so a parse failure or a
missing key for one field must not blank a field that parsed fine - `resolveEntityTranslations()` checks
each requested field's value in the parsed response independently.

## Diner-facing locale selection

Manual picker (`LanguagePicker`), no silent auto-switching. `Accept-Language` (parsed in
`apps/diner-app/src/lib/locale.ts`) is used only to pick the *default* selection on first load, when no
explicit `?locale=` is present - the diner can always override it, and once they pick explicitly the
`?locale=` query param is the sole source of truth (Next.js re-runs the server-rendered page on navigation,
the same mechanism already used for the existing `?tab=` param).

**No AI-translated indicator.** Diners cannot distinguish an AI translation from a human one anywhere in
the UI - both come back through the same flat `publicDishSchema`/`publicDishIngredientSchema` shape, with
no provenance field added to the public response.

## Admin-portal visibility (superadmin only)

The codebase already has a three-role system (`userRoleEnum`: `diner` | `restaurant_admin` |
`superadmin`, `packages/db/src/schema/schema.ts`) and existing superadmin-gated routes/pages to gate on
(e.g. `GET /ingredients/:id/translations` was already superadmin-only; the whole `meta-ingredients.tsx`
admin-portal route is already superadmin-gated at the router level in `App.tsx`). No new role system was
needed. `GET .../ai-translations` (new, on both `dishes.ts` and `ingredients.ts`) checks
`auth.user.role !== "superadmin"` explicitly and 403s otherwise, independent of whether the caller can
otherwise manage the dish/restaurant - a restaurant admin who can edit a dish still cannot see this
endpoint's data. No new column was needed to record provenance for this: existence of a row in
`ai_content_translations` vs. `dish_translations`/`ingredient_translations` already is the provenance
signal.

## Deferred (explicitly out of scope for this slice)

- Moving cache-miss handling out of the request path into a background job/worker (would always serve
  source text on a miss and let a queue backfill). Revisit if traffic/catalog/locale-count grows
  10-50x - the repo has no job-queue library today.
- A rate limiter / spend cap on the generation path specifically (the allow-list is the only
  abuse-prevention gate; no ceiling was requested).
- Extending `entityType` coverage to `menu_section`/`menu`/`restaurant`, or to
  `ingredients.commonAllergenGroup`'s home table directly - the schema supports it as a pure
  application-code change, but only `dish`/`ingredient` fields are wired up.
- Reconsidering the unified-table-with-`source`-column schema if maintaining two parallel systems becomes
  its own burden.
