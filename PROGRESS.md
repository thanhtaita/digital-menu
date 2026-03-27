# Project progress (for Cursor & humans)

**Purpose:** Track what is **done** vs **still to do** relative to `TECH_PLAN.md`. Keep this file **short**; update it when you finish a milestone or reprioritize.

**Sources of truth**

- **HTTP + admin SPA routes:** `IMPLEMENTED_ROUTES.md` (must stay current when routes change).
- **Architecture & phases:** `TECH_PLAN.md`.

**How to use in Cursor**

- Start tasks from **Suggested next** (below) unless the user overrides.
- After shipping a feature, mark items **Done** / **Partial** here and ensure `IMPLEMENTED_ROUTES.md` lists new routes.

---

## Legend

| Tag            | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| **Done**       | Implemented and usable for that slice.               |
| **Partial**    | Exists but incomplete vs `TECH_PLAN.md` description. |
| **Not started**| No real implementation in repo yet.                |

---

## By `TECH_PLAN.md` step

### Step 0 — Monorepo foundation

- **Done:** pnpm workspace, Turborepo, TypeScript, `packages/db` + Drizzle migrations, `packages/shared` (Zod + types).

### Step 1 — Test data seeding

- **Done:** `packages/seed` (`seed-test-data.ts`) — sample ingredients + aliases.
- **Not started:** Full USDA / Wikimedia ingestion pipeline (plan: Phase 2).

### Step 2 — Fastify API core

- **Done:** Session auth (`/auth/*`), CORS/cookies, `health`, restaurants → menus → sections → dishes CRUD, dish ingredients, ingredient dictionary + **pending request / approve / reject** flow (see `IMPLEMENTED_ROUTES.md`).
- **Partial:** Ingredient search in code may use `ilike`; plan also calls out **`pg_trgm`** — confirm indexes/migrations match intent.
- **Done:** Aggregated **`GET /public/restaurants/:slug/menu`** for diner/QR (published menus, active restaurants).
- **Not started:** **`/users/me/restrictions`** (or equivalent), **QR PNG** route, **rate limiting** on search (plan Step 5).

### Step 3 — Admin portal (Vite + React)

- **Done:** Login/register, app shell, restaurant list, **menu builder** (create menu/section/dish, search/tag ingredients, **request new ingredient**), **superadmin** ingredient catalog (pending queue + direct add).
- **Partial:** Restaurant **PATCH** exists; rich “restaurant profile” UX may be thin. **Menu publish** — API supports `isPublished`; confirm builder exposes it clearly.
- **Not started:** **QR code** display in admin, optional dashboard polish beyond current flows.

### Step 4 — Diner app (Next.js 15)

- **Partial:** `apps/diner-app` — **`/r/[slug]`** menu page (server fetch), ingredient **links** (`?i=<slug>`) + **modal** detail (name, description, allergen, nutrients). **Not started:** filters, restrictions UI, auth/profile.

### Step 5 — Integration & hardening

- **Partial:** Vitest tests in admin portal (e.g. login, register, menu builder).
- **Not started:** Playwright E2E (QR → menu → ingredient), loading/error boundaries, systematic rate limits, optimistic updates where planned.

---

## Suggested next work (priority order)

1. **QR** — API PNG + admin UI to show/download; then E2E path.
2. **Restrictions** — API + diner profile + `restriction-engine` alignment with `TECH_PLAN.md` data flow.
3. **Hardening** — Rate limits, `pg_trgm` if missing, Playwright, coverage goals.

*(Reorder when product priorities change; keep “Done/Partial” sections honest.)*

---

## Completed highlights (snapshot)

- Monorepo + DB schema + shared Zod layer.
- Auth + restaurant → menu hierarchy + dish tagging + ingredient dictionary with **approval workflow** (restaurant requests → superadmin approves).
- Admin portal: auth, restaurants, builder, meta ingredient management.
- **Public menu API + diner app:** `GET /public/restaurants/:slug/menu`, Next.js `/r/[slug]` with ingredient modal.

---

*Last reviewed: align this file whenever a `TECH_PLAN.md` phase moves forward.*
