## 2026-08-02 20:24 — Add AI auto-translation for dish/ingredient content

New goal (`internationalization`) and feature, implementing the design from a prior scout investigation +
captain product decisions (locale-selection UX, initial 11-language allow-list, no diner-facing
AI-translated indicator, no spend ceiling, reuse Gemini rather than adding Claude, superadmin-only
provenance visibility - not checked into this repo).

Adds `ai_content_translations` (migration `0014`), scoped to `dish`/`ingredient` - a hash-keyed cache,
separate from and lower-precedence than the existing human-entered `dish_translations`/
`ingredient_translations` tables, which stay completely untouched. `apps/api/src/services/
ai-translation.ts` resolves each field per the precedence rules (human row wins unconditionally → AI
cache hit-by-hash → synchronous generation with a ~2.5s timeout and upsert-on-success → source-text
fallback on any failure, with no failure ever written to the cache). Generation reuses the existing Gemini
channel at `gemini-2.0-flash-lite` (new `"translate"` purpose in `lib/ai/config.ts`) - no new provider,
SDK, or dependency.

`GET /public/restaurants/:slug/menu` gains a `?locale=` parameter, validated against a fixed,
env-overridable 11-language allow-list (`isSupportedTranslationLocale`) before any DB lookup or
generation is attempted - closes the abuse-prevention gap on this unauthenticated endpoint. The diner app
gets a manual `LanguagePicker`; `Accept-Language` only pre-selects the picker's default (never a silent
override), threaded through the existing `?locale=`-style server-component re-fetch pattern already used
for `?tab=`.

Also closed the pre-existing gap where the diner-facing public menu never read the manual translation
tables at all (the manual admin-portal translation UI/API existed but had no consumer) - human
translations are now actually served to diners, independent of whether AI translation is even configured.

Added a superadmin-only `GET .../ai-translations` listing endpoint on both `dishes.ts` and
`ingredients.ts`, and a read-only "AI-generated translations" panel in the existing manual-translation UI
in `menu-builder.tsx`/`meta-ingredients.tsx`, gated on `role === "superadmin"` - verified the codebase
already had a superadmin role and existing superadmin-gated routes to model this on (no new role system
needed).

Verified: `packages/shared`, `packages/db`, `apps/api` (tsc, pre-existing unrelated test-file errors in
`ai-chat-summarization.test.ts`/`ai-chat.routes.test.ts` confirmed via `git log` to predate this branch),
`apps/diner-app` (tsc), and `apps/admin-portal` (`vite build`) all build clean. Added
`ai-translation.test.ts` (13 cases: allow-list gating, manual-wins precedence, cache hit/miss, per-field
fallback on malformed/partial JSON, timeout/error fallback, unconfigured-provider fallback,
null/empty-field skip) and `public-menu-translation.routes.test.ts` (4 cases covering the route's
locale-gating and field-substitution behavior) in `apps/api`; `locale.test.ts` (8 cases) in
`apps/diner-app`. Full suites: 130/130 passing in `apps/api`, 43/43 in `apps/diner-app`.

While implementing `generateWithTimeout()`, found and fixed a real bug during test-writing: the timeout
promise in the `Promise.race` was never cleared or given a rejection handler, so on the (normal-case) path
where `generateText()` wins the race, the abandoned timer would still fire later and reject with nothing
listening - an unhandled-rejection risk under load. Fixed with `clearTimeout` in a `finally` and a no-op
`.catch()` on the timeout promise.

**Known gap, not fixed here**: could not apply or live-verify migration `0014` against a running Postgres
- no `docker`, no `sudo`, and nothing listening on 5432/5433 in this disposable worktree. The generated
SQL (`packages/db/drizzle/0014_modern_gladiator.sql`) was reviewed manually and is a single clean
`CREATE TABLE` + two indexes with no unexpected diff against the prior schema state (per the
`db-migration` skill's guidance to distrust a suspiciously large diff - this one wasn't). Whoever merges
this should run `pnpm --filter @digital-menu/db drizzle:migrate` and confirm the table exists before
relying on this feature in a real environment.
