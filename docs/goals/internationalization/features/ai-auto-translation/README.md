# Feature: AI auto-translation

## What it does

The public diner-facing menu (`GET /public/restaurants/:slug/menu`) now accepts a `?locale=` query
parameter. For a supported locale, dish name/description and ingredient name/description/allergen-group
are resolved in this order, per field:

1. **Human translation wins unconditionally.** If a row exists in the pre-existing
   `dish_translations`/`ingredient_translations` tables for that locale, it's used as-is, no hash check.
2. **Otherwise, the AI cache is checked** (`ai_content_translations`, keyed on
   `(entityType, entityId, field, locale, sourceHash)`). A hash match is a cache hit. A miss (no row, or
   source text changed since generation) triggers synchronous generation via the existing Gemini channel
   (`gemini-2.0-flash-lite`), with a ~2.5s timeout, and upserts the cache on success.
3. **Any failure - timeout, provider error, malformed output, unsupported locale - falls back to the
   source-language text for that request only.** No failure is ever written to the cache; a bare miss is
   self-describing and retries naturally on the next request.

Diners pick their language manually (`LanguagePicker` in the diner app); `Accept-Language` is used only to
pre-select the picker's default, never as a silent override. Diners cannot tell an AI translation from a
human one - there's no UI indicator. Superadmins (only) can see which cached translations are
AI-generated, in a read-only panel below the existing manual-translation editor in both the dish
(menu-builder) and ingredient (ingredient catalog) admin UI.

## Entry points in code

- `packages/db/src/schema/schema.ts` - `aiContentTranslations` table (migration `0014`).
- `apps/api/src/services/ai-translation.ts` - `resolveEntityTranslations()`, the resolution/generation/
  fallback logic; `isSupportedTranslationLocale()`, the abuse-prevention allow-list gate.
- `apps/api/src/routes/public-menu.ts` - `?locale=` handling on `GET /restaurants/:slug/menu`.
- `apps/api/src/routes/dishes.ts`, `apps/api/src/routes/ingredients.ts` - `GET .../ai-translations`
  (superadmin-only listing of cached AI rows, for the admin UI).
- `apps/api/src/lib/ai/config.ts` - `"translate"` purpose added to `resolveModel()`, same
  `gemini-2.0-flash-lite` default as `"suggestion"`/`"summarize"`, `AI_TRANSLATION_MODEL` env override.
- `packages/shared/src/translation.ts` - `SUPPORTED_TRANSLATION_LOCALES` (11-language default allow-list),
  `SOURCE_LOCALE`.
- `apps/diner-app/src/lib/locale.ts` - `Accept-Language` inference, allow-list validation.
- `apps/diner-app/src/components/language-picker.tsx` - the manual picker.
- `apps/diner-app/src/app/r/[slug]/page.tsx`, `menu-with-modal.tsx` - threading the resolved locale
  through the server-fetched menu and into the picker's default.
- `apps/admin-portal/src/routes/menu-builder.tsx`, `meta-ingredients.tsx` - the superadmin-only
  AI-generated-translations read-only panel.

## See also

- [`design.md`](./design.md) - precedence rules, schema, locale allow-list, failure handling, and the
  product decisions that shaped scope.
- [`task-log.md`](./task-log.md) - chronological history.
