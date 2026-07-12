# digital-menu — agent knowledge base

This file and `.claude/skills/*/SKILL.md` are the **only** project-knowledge surfaces an agent needs. There is no `PROGRESS.md`, `IMPLEMENTED_ROUTES.md`, or per-app `FEATURES.md` anymore - their content lives here or in a skill. `SETUP.md` is the one exception: it's a human/agent environment setup runbook, not project knowledge, and stays standalone.

## Keep this file current

- After shipping any feature, route, or schema change, update the relevant section below **in the same change**.
- If the change touches DB migrations, AI chat, seeding/ingredients, or HTTP/page routes, also update the matching skill file (see [Skills index](#skills-index)).
- If the change alters a *convention* (not just a fact - e.g. a new dependency rule, a new testing expectation), also update `AGENTS.md` and `.cursor/rules/global.md` so Codex/Cursor don't drift out of sync with this file.
- There is no separate progress log. Current capability is whatever **Features implemented** below says; if something isn't mentioned, treat it as not implemented.
- Don't reintroduce deleted docs (`PROGRESS.md`, `IMPLEMENTED_ROUTES.md`, `FEATURES.md`) - extend this file or the relevant skill instead.

## Project goal

A multi-tenant restaurant menu platform: restaurant admins build menus and tag dishes with ingredients from a shared global dictionary; diners browse menus with allergy/diet-aware warnings, follow a social layer (posts/follows/feed), and get LLM-driven conversational dish recommendations through an AI chat assistant.

## Monorepo structure

pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) built with Turborepo (`turbo.json`). `packageManager: pnpm@9.0.0`. Path aliases in `tsconfig.base.json`: `@db/*` → `packages/db/src/*`, `@shared/*` → `packages/shared/src/*`.

| Path | Purpose | Primary tech |
|---|---|---|
| `apps/api` | Backend HTTP API, port **3002** in local dev | Fastify 5 (ESM), Drizzle ORM + `pg`, Zod, `@google/generative-ai` + raw-fetch OpenAI client |
| `apps/admin-portal` | Restaurant-admin/superadmin SPA | Vite, React 19, React Router 7, TanStack Query, Tailwind 4, shadcn/ui-style components |
| `apps/diner-app` | Public diner-facing site | Next.js 15 App Router, React 19, Tailwind 3 + custom CSS-variable design tokens, no i18n framework |
| `packages/db` | Drizzle schema + migrations, shared Postgres client | Drizzle ORM + drizzle-kit |
| `packages/shared` | Zod schemas + TS types/enums, imported by API and both frontends | Zod |
| `packages/seed` | Ordered data-seeding scripts (ingredients, then menus) | Drizzle, bcrypt |

Dependency direction: `packages/*` never depends on `apps/*`. `apps/api` depends only on `packages/db` and `packages/shared`.

## System design

**Multi-tenancy**: `restaurants` is the tenant root (menus → sections → dishes hang off it). The **ingredient dictionary is global**, shared across all restaurants - not tenant-scoped. Restaurants can request new ingredients (`approvalStatus: pending`); a superadmin approves them into the shared dictionary.

**Auth**: cookie-based sessions (`sessions` table, 7-day expiry, bcrypt password hashing). Roles: `diner` / `restaurant_admin` / `superadmin`. Auth is **not** a Fastify hook - `middleware/auth.ts`'s `requireAuth(request, reply)` is called as the first line of nearly every route handler; it writes a 401 itself and returns `undefined` on failure, so handlers do `if (!auth) return;`. Authorization (as opposed to authentication) lives in `lib/restaurant-access.ts` (`canUserManageRestaurant[WithRole]` - owner, `restaurant_admins` row, or superadmin bypass).

**Route-handler conventions** (`apps/api/src/routes/*.ts`): no controller/repository layers - handlers do auth → param coercion → authorization → parent-hierarchy existence checks → Zod `schema.safeParse(body)` (422 with `.flatten()` on failure) → Drizzle query/mutation, inline. Only AI/recommendation logic gets an extracted `services/` module. No global Fastify error handler; every route/service maps its own errors to a status code plus an `error` string and often a machine-readable `code` (e.g. `AI_NOT_CONFIGURED`, `SLUG_TAKEN`). No centralized env/config module - `process.env.X` is read ad hoc at the point of use with an inline default.

**AI provider abstraction** (`apps/api/src/lib/ai/`) is the most polished part of the codebase: a provider-agnostic facade (`index.ts`/`config.ts`/`types.ts`) dispatching to `channels/gemini.ts` or `channels/openai.ts`, both implementing the same `generateText`/`chat`/`chatStream` contract. See the **`ai-chat-architecture`** skill for the full design.

**Two parallel systems that look related but aren't unified** (don't assume they are when making changes):
- **i18n**: `ingredient_aliases` (informal, language-tagged, used for fuzzy alias matching/search) vs. `dish_translations`/`ingredient_translations` (formal BCP-47 locale overlays, used for display localization - root table holds the source-language fallback). See the **`seed-and-ingredient-data`** skill.
- **Recommendations**: an embeddings/pgvector layer (`dish_embeddings`, `user_preference_embeddings`, `recommendations` - the DB/API layer is implemented, but the service that actually populates the vectors doesn't exist yet) vs. the newer **LLM-based AI chat** (`ai_chat_sessions`/`ai_chat_messages`), which is what the diner app's UI actually uses today. See the **`recommendation-embeddings`** skill for the pgvector system's current state and its missing embedding-generation service.

## Database schema overview

Source of truth: `packages/db/src/schema/schema.ts`. Grouped by domain:

- **Users & auth**: `users` (role enum, bcrypt hash, avatar/bio), `sessions`.
- **Restaurant/menu hierarchy**: `restaurants` (slug-unique tenant root) → `menus` (`isPublished`) → `menu_sections` → `dishes` (+ `dish_media` galleries).
- **Ingredient dictionary** (global, not restaurant-scoped): `ingredients` (approval workflow, allergen flags, jsonb `nutrients` backfilled from `fdc.*`), `ingredient_media`, `ingredient_aliases` (lang-tagged), `dish_ingredients` (junction, restrict-on-delete), `ingredient_fdc_candidates` (FDC match review queue).
- **Restrictions & admin**: `user_restrictions` (allergy/dislike/diet, block/warn severity), `restaurant_admins` (multi-admin junction).
- **Translations**: `dish_translations`, `ingredient_translations` - locale-keyed overlays, separate from `ingredient_aliases`.
- **Embeddings/recommendations** (legacy/parallel to AI chat): `user_preferences`, `dish_embeddings`, `user_preference_embeddings`, `embedding_jobs`, `recommendations`, `recommendation_feedback`.
- **Social layer**: `user_follows`, `posts`, `post_media`, `post_likes`, `post_comments` (one level of reply threading via self-referencing `parentCommentId`).
- **AI chat**: `ai_chat_sessions` (one per user × restaurant, rolling `conversationSummary`, `likedDishNames` jsonb), `ai_chat_messages` (role, content, `recommendations` jsonb on assistant turns).

## Reference data: USDA FoodData Central (`fdc` schema)

A full USDA FoodData Central "Foundation Foods" export (2025-12-18, 24 tables, ~600k rows) is loaded into a dedicated **`fdc` Postgres schema** in the same database as the app - separate from the Drizzle-managed `public` schema and **intentionally not tracked by drizzle-kit/migrations**, since it's static third-party reference data, not app-owned evolving schema.

- **Source data + import tooling**: `resources/FoodData_Central_foundation_food_csv_2025-12-18/` (the raw CSVs + the vendor's field-description workbook) and its `import/` subfolder:
  - `schema.sql` - hand-written DDL for all 24 `fdc.*` tables, with PK/FK constraints where the source data is clean, and a header comment documenting known referential gaps in USDA's own export (e.g. ~94% of `food_nutrient_conversion_factor` rows reference foods outside this Foundation-only download - left as plain indexed columns, not enforced FKs, rather than aborting the load).
  - `load.py` - Python/psycopg2 script that applies `schema.sql` then bulk-loads each CSV via native Postgres `COPY` (quoting/embedded newlines parsed by Postgres itself, not a hand-rolled parser). Rerun `python load.py --reset` to wipe and reload from scratch. Requires `psycopg2-binary` (`pip install psycopg2-binary`); no Node dependency was added for this.
  - `smoke_test.sql` / `smoke_test.py` - example queries shaped like real API calls (ingredient search, full nutrient panel for one food, pivoted macros, portion/serving-size conversion, category facets, ingredient-to-`fdc_id` candidate matching, a referential-gap regression check). Run `python smoke_test.py` to execute them all and print results.
- **Key tables**: `fdc.food` (fdc_id, description, food_category_id, data_type), `fdc.food_nutrient` (fdc_id, nutrient_id, amount - per-100g), `fdc.nutrient` (id, name, unit_name), `fdc.food_category`, `fdc.food_portion` + `fdc.measure_unit` (household serving-size conversions, e.g. "2 tbsp = 33.9g"), `fdc.foundation_food`.
- **Backfill implemented**: `public.ingredients.fdcId`/`foodCategory`/`nutrients` (`packages/db/src/schema/schema.ts`) are populated by `pnpm --filter @digital-menu/api backfill:fdc`, which fuzzy-matches against `fdc.food.description` (pg_trgm, same approach as the AI ingredient suggestion feature) and denormalizes a fixed macro set (cal/protein/fat/carbs/sodium) into `nutrients` jsonb - no live join to `fdc.*` at request time. Ambiguous matches queue in `ingredient_fdc_candidates` for superadmin review (`/app/meta/ingredients` → "FDC nutrition matches"). See the **`seed-and-ingredient-data`** skill's "FDC nutrition backfill" section for the full design.
- Same `DATABASE_URL` as the rest of the app (`postgres://postgres:123456@localhost:5433/digital_menu` in local dev) - it's the same physical database, just a different schema, so any `pg`/Drizzle client already connected to the app DB can query `fdc.*` directly.

## Features implemented

### `apps/api`

Session auth (register/login/logout/me); restaurant/menu/section/dish CRUD with translations and media galleries (append/reorder/delete, legacy single-image endpoints kept for compatibility); ingredient dictionary search + approval workflow (restaurant request → superadmin approve/reject/edit/delete) + translations + media; FDC nutrition backfill (`GET/POST /ingredients/fdc-candidates*` review queue + `backfill:fdc` script - see `seed-and-ingredient-data` skill); public no-auth endpoints (`/public/restaurants`, `/public/restaurants/:slug/menu`, `/public/restaurants/:slug/posts`); user restrictions CRUD; QR PNG generation; AI ingredient suggestion endpoint (pg_trgm fuzzy match against the dictionary, confidence-filtered - see `recommendation-embeddings` skill for future phases); user preferences + pgvector semantic recommendations (DB/API implemented, embedding-generation service not yet built - see `recommendation-embeddings` skill); full social layer (profiles, follows, posts, likes, threaded comments, feed); AI chat (send/stream/history/clear/like) - see the `ai-chat-architecture` skill.

`@fastify/rate-limit` is registered globally with `global: false` in `apps/api/src/app.ts` (per-user via session cookie, falling back to per-IP - see `lib/rate-limit.ts`'s `rateLimitKeyGenerator`); only the LLM-backed routes (`/chat`, `/chat/stream`, `/dishes/suggest-ingredients`) and ingredient search (`GET /ingredients`) opt in via per-route `config: { rateLimit: ... }` (limits in `lib/rate-limit.ts`'s `LLM_RATE_LIMIT`/`SEARCH_RATE_LIMIT`). No other routes are throttled.

### `apps/admin-portal`

Auth (login/register/logout); restaurant list + inline name/description edit + QR code modal (fetches `GET /restaurants/:id/qr` as a blob, shows the PNG with a download link); menu builder per restaurant (menus/sections/dishes create-rename-delete with cascade-blocking confirmations, publish/unpublish, multi-file media galleries with reorder, ingredient search/tag/detach, "request new ingredient" inline form, AI ingredient suggestion panel with accept-selected flow, per-dish translations CRUD); superadmin ingredient catalog (`/app/meta/ingredients` - pending queue approve/reject, search + edit + delete + translations + media, direct dictionary add).

Known gaps: no rich restaurant-profile editor, no self-service role changes.

### `apps/diner-app`

Discovery page (active restaurants list); menu page (`/r/[slug]`, server-rendered, media galleries + legacy image fallback, ingredient pill links opening a bottom-sheet modal with allergen callout/nutrients); auth pages; profile page (restrictions CRUD, taste-preferences textarea that auto-generates from restrictions and feeds the embedding pipeline); restriction-engine dish badges (blocked/warned highlighting; **diet-type filtering not yet applied to dishes**); social layer UI (`/u/[userId]` profiles, `/feed`, `/posts/[postId]` with media carousel + threaded comments, restaurant posts tab); AI chat page (`/r/[slug]/chat` - streaming SSE responses, prompt chips, likeable recommendation cards opening a dish detail sheet, clear-conversation).

Known gaps: semantic (pgvector) recommendations have a working API but **no UI** yet; no i18n framework wired up despite DB-level translation tables existing; no Playwright E2E.

## Conventions & rules

- **Paths**: always refer to files relative to repo root.
- **Diffs**: prefer small, focused diffs over full-file rewrites unless a full refactor is explicitly requested.
- **Dependency direction**: `packages/*` must never depend on `apps/*`; `apps/api` depends only on `packages/db` + `packages/shared`.
- **API design**: use Zod schemas from `packages/shared` for request/response validation; keep route handlers thin, push business rules into `lib/`/`services/` helpers when they grow (see [System design](#system-design) for the current baseline - most CRUD routes are still handler-only, that's the existing norm, not a violation).
- **Error handling**: consistent error objects (status + `error` message, often a `code`); never leak raw errors; prefer early returns over deep nesting.
- **Configuration**: there's no centralized config module today (ad hoc `process.env` reads are the existing pattern) - don't block on "fixing" this unless asked; if you add a new env var, follow the existing inline-default style used in `lib/ai/config.ts` / `lib/uploads.ts`.
- **Logging**: Fastify's built-in logger (Pino) for HTTP-level logs; the bespoke `lib/ai-chat-logger.ts` file-logger only for LLM call auditing. Don't sprinkle ad hoc `console.log`.
- **Change scope**: stay within the stated/implied scope; don't rename public APIs or shared types without explicit authorization; don't add new top-level dependencies without being asked - reuse the existing stack first.
- **Testing**: Vitest everywhere (unit + Fastify `inject`-based route tests in `apps/api`; Testing Library + jsdom in the frontends). Extend existing test files over creating many small new ones; add a test for new behavior or explain why one isn't practical yet.
- **Helper reuse**: before adding a new helper, search `packages/shared` and `apps/api/src/lib` for an existing one first.
- **Plan/role awareness**: when following a feature plan, obey the current step and don't jump ahead unless told to; when given a role (Implementation/Reviewer/Testing), stay in that lane.

## Known gaps / gotchas

- **API port is 3002 in local dev, but the code's own fallback default is 3001.** `apps/api/src/index.ts` falls back to `PORT=3001` when unset, but `apps/api/package.json`'s `dev` script hardcodes `PORT=3002` via `cross-env`, which wins. Both frontends' hardcoded fallback (`http://localhost:3002/...` in `api-client.ts`/`image-url.ts`/etc.) and `.env.example`/`SETUP.md` now consistently point at 3002 to match actual dev behavior - previously `SETUP.md`/`.env.example` said 3001 and would silently fail if followed literally. If you ever touch the `dev` script's port, update `.env.example`, `SETUP.md`, and both frontends' fallback defaults together.
- **DB migration discipline is strict** because tracking has desynced before - two columns were once added to the dev DB out-of-band (no tracked migration), and `packages/db/drizzle/meta/` was separately missing several snapshot files, which together made `drizzle-kit generate` produce a dangerously wrong diff (recreating 16 already-existing tables) until it was fixed and verified directly against the live DB. Fixed now (migration `0009`, tracking reconciled, `generate` reports clean). See the `db-migration` skill for the full story and procedure; never hand-edit `packages/db/drizzle/*.sql` or `meta/_journal.json` outside a verified recovery like that one.
- `ingredient_aliases` seed data currently tags some non-English aliases (French/Italian) with `languageCode: "en"` - a known rough edge in `packages/seed/src/seed-test-data.ts`, not a schema limitation.
- Diet-type restrictions are stored but not yet applied to dish-level filtering in the diner app (needs per-ingredient diet-compatibility data).
- Rate limiting covers only the LLM-backed routes and ingredient search (see [Features implemented](#features-implemented) above); every other route (auth, restaurant/menu/dish CRUD, social layer, uploads, etc.) is still unthrottled.
- `pg_trgm` extension usage for ingredient fuzzy search should be reconfirmed if search behavior seems off (skipped silently if the extension is unavailable).
- No Docker Compose or other deployment config exists yet; local dev only.
- `public.ingredients.fdcId`/`nutrients` are backfilled by `pnpm --filter @digital-menu/api backfill:fdc` (see [Reference data](#reference-data-usda-fooddata-central-fdc-schema) above and the `seed-and-ingredient-data` skill) - but this only does anything if the `fdc` schema has actually been loaded into your local DB first (`resources/.../import/load.py`); most ingredients will still have `fdc_id: null` until both steps have been run.

## Skills index

Deep, on-demand reference/procedural knowledge lives in `.claude/skills/*/SKILL.md` so it doesn't bloat this always-loaded file. Invoke the matching skill when the task touches its area:

| Skill | Use when... |
|---|---|
| `db-migration` | Adding/changing any table, column, or index in `packages/db/src/schema/schema.ts` |
| `ai-chat-architecture` | Working on the AI chat recommendation feature, the `lib/ai/` provider abstraction, streaming, or summarization |
| `seed-and-ingredient-data` | Running/editing seed scripts, working on the ingredient dictionary, aliases, translations, or the FDC nutrition backfill, or picking up the ingredient translation pipeline plan |
| `api-routes` | Looking up or adding an HTTP route or frontend page route, or running the manual QA walkthrough |
| `recommendation-embeddings` | Working on pgvector semantic recommendations, building the missing embedding-generation service, or extending AI ingredient suggestions beyond Phase 1 |

## Setup

See `SETUP.md` for environment setup, seeding order, and troubleshooting (kept standalone as a human/agent runbook).
