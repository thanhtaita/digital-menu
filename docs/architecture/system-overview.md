# System overview

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
- **i18n**: `ingredient_aliases` (informal, language-tagged, used for fuzzy alias matching/search) vs. `dish_translations`/`ingredient_translations` (formal BCP-47 locale overlays, human-entered, always take precedence when present - root table holds the source-language fallback) vs. `ai_content_translations` (disposable, hash-keyed AI-generated cache, only ever consulted when no human row exists for that locale). The public diner-facing menu (`GET /public/restaurants/:slug/menu?locale=`) resolves through the latter two; `ingredient_aliases` is a separate mechanism entirely (search, not display). See the **`seed-and-ingredient-data`** skill and [`docs/goals/internationalization/`](../goals/internationalization/README.md).
- **Recommendations**: an embeddings/pgvector layer (`dish_embeddings`, `user_preference_embeddings`, `recommendations` - the DB/API layer is implemented, but the service that actually populates the vectors doesn't exist yet) vs. the newer **LLM-based AI chat** (`ai_chat_sessions`/`ai_chat_messages`), which is what the diner app's UI actually uses today. See the **`recommendation-embeddings`** skill for the pgvector system's current state and its missing embedding-generation service.

## Rate limiting

`@fastify/rate-limit` is registered globally with `global: false` in `apps/api/src/app.ts` (per-user via session cookie, falling back to per-IP - see `lib/rate-limit.ts`'s `rateLimitKeyGenerator`); only the LLM-backed routes (`/chat`, `/chat/stream`, `/dishes/suggest-ingredients`) and ingredient search (`GET /ingredients`) opt in via per-route `config: { rateLimit: ... }` (limits in `lib/rate-limit.ts`'s `LLM_RATE_LIMIT`/`SEARCH_RATE_LIMIT`). No other routes are throttled. See [`docs/goals/platform-hardening/features/llm-and-search-rate-limiting/`](../goals/platform-hardening/features/llm-and-search-rate-limiting/README.md) for why and when this shipped.

## See also

- [`docs/architecture/data-model.md`](./data-model.md) - database schema by domain
- [`docs/architecture/fdc-reference-data.md`](./fdc-reference-data.md) - the USDA FoodData Central reference schema
- [`docs/architecture/known-gaps.md`](./known-gaps.md) - standing gotchas that aren't yet (or won't become) ADRs
- `.claude/skills/*/SKILL.md` - deep dives per subsystem (AI chat, DB migrations, seeding/ingredients, route catalog, recommendation embeddings)
