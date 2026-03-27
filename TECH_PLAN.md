# Tech Stack

- **Frontend (Admin Portal):** Vite + React 18 + TypeScript + React Router v7 + shadcn/ui + Tailwind CSS
- **Frontend (Diner App):** Next.js 15 (App Router) + TypeScript + shadcn/ui + Tailwind CSS
- **Backend:** Fastify + TypeScript — with type-safe API client via shared Zod schemas + fetch
- **ORM / Migrations:** Drizzle ORM + drizzle-kit (TypeScript schema = migration source of truth)
- **Database:** PostgreSQL — with `pg_trgm` GIN indexes for ingredient fuzzy search
- **Authentication:** Better Auth (Drizzle adapter) — email/password + role-based access
- **Monorepo:** Turborepo + pnpm workspaces
- **Validation:** Zod (shared schemas across API + frontends)
- **Data Ingestion:** Node.js scripts using `csv-parse` (USDA CSVs) + Wikimedia Enterprise REST API
- **QR Code:** `qrcode` npm package (server-side PNG generation)
- **Image Storage:** Local disk for dev → Cloudflare R2 for production (S3-compatible)
- **Deployment:** Docker Compose (recommended) or Railway/Render PaaS
- **Testing:** Vitest (unit/integration), Playwright (E2E for diner QR flow)
- **Other tools:** drizzle-kit studio (DB GUI), pnpm workspaces, Turborepo build cache

---

# Architecture Overview

```mermaid
graph TD
    QR[QR Code] --> DinerApp

    subgraph Frontend
        AdminPortal["Admin Portal\n(Vite + React)"]
        DinerApp["Diner App\n(Next.js 15)"]
    end

    subgraph Backend
        API["Fastify API\n/api/v1"]
        BetterAuth["Better Auth\n(session middleware)"]
        API --> BetterAuth
    end

    subgraph Data
        PG[(PostgreSQL)]
        R2[(Cloudflare R2\nimage storage)]
    end

    subgraph Seed Pipeline
        USDA["USDA FoodData CSVs\n(foundation_food)"]
        Wiki["Wikimedia Enterprise API"]
        SeedScript["packages/seed\nNode.js scripts"]
        USDA --> SeedScript
        Wiki --> SeedScript
        SeedScript --> PG
    end

    AdminPortal -->|Typed API client| API
    DinerApp -->|Typed API client (server-side)| API
    API --> PG
    API --> R2
```



**Component relationships:**

- `packages/db` — Drizzle schema + generated migrations, imported by `apps/api`
- `packages/shared` — Zod schemas + TypeScript enums, imported by all apps
- `packages/seed` — one-time/periodic USDA + Wikipedia ingestion scripts
- `apps/api` — Fastify server with type-safe routes (schemas from `packages/shared`)
- `apps/admin-portal` — internal SPA, auth-gated, uses typed API client (fetch + Zod)
- `apps/diner-app` — public-facing, server-rendered menu pages, QR code target

---

# File Structure

```
digital-menu/
├── package.json                    # Root (pnpm workspace config)
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
├── TECH_PLAN.md                    ← this file
├── PROGRESS.md                     ← done vs next vs plan (update when milestones ship)
├── IMPLEMENTED_ROUTES.md           ← keep in sync: list every implemented API + admin route
│
├── apps/
│   ├── admin-portal/               # Vite + React (existing empty dir)
│   │   └── src/
│   │       ├── routes/             # auth/, dashboard, menus/, dishes/, ingredients/
│   │       ├── components/         # ui/ (shadcn), IngredientCombobox, DishForm, MenuSectionEditor
│   │       ├── hooks/
│   │       └── lib/api-client.ts   # Typed API client (fetch + Zod validation)
│   │
│   ├── diner-app/                  # Next.js 15 App Router
│   │   └── src/app/
│   │       ├── r/[slug]/page.tsx   # Restaurant menu (server component) — QR target URL
│   │       ├── profile/            # User restrictions editor
│   │       └── auth/               # login, register
│   │   └── src/components/         # DishCard, IngredientModal, FilterPanel, RestrictionBadge
│   │   └── src/lib/
│   │       ├── api-client.ts
│   │       └── restriction-engine.ts  # Client-side filter/warn logic
│   │
│   └── api/                        # Fastify server
│       └── src/
│           ├── app.ts              # Fastify app + route registration
│           ├── routes/             # auth, restaurants, menus, sections, dishes, ingredients, users, qr
│           ├── middleware/         # auth, role-guard, cors, rate-limit
│           └── lib/db.ts           # Drizzle client
│
└── packages/
    ├── db/                         # Drizzle schema + migrations
    │   └── src/schema/             # restaurants, menus, dishes, ingredients, users
    ├── shared/                     # Zod schemas + TypeScript enums
    │   └── src/                    # restriction.ts, roles.ts, diet-types.ts
    └── seed/                       # USDA + Wikipedia ingestion
        └── src/
            ├── parse-usda.ts       # Stream CSV → filter → normalize ingredient names
            ├── fetch-wiki.ts       # Wikimedia Enterprise API client
            └── upsert-ingredients.ts
```

---

# Database Schema (Key Tables)

```sql
-- Restaurants and menu hierarchy
restaurants    (id, slug UNIQUE, name, description, logo_url, owner_id, is_active)
menus          (id, restaurant_id FK, name, is_published, display_order)
menu_sections  (id, menu_id FK, name, display_order)
dishes         (id, section_id FK, name, description, price, image_url, is_available, display_order)

-- Ingredient knowledge layer
ingredients    (id, canonical_name UNIQUE, slug UNIQUE, description, image_url,
                fdc_id, food_category, nutrients JSONB,
                is_common_allergen, common_allergen_group)
               -- GIN index on canonical_name for pg_trgm fuzzy search
ingredient_aliases (id, ingredient_id FK, alias, language_code)
                   -- GIN index on alias for fuzzy search

-- Junction: restaurant-specific dish ingredients
dish_ingredients (id, dish_id FK, ingredient_id FK, is_optional, is_hidden, display_order)
                 -- UNIQUE(dish_id, ingredient_id)

-- Users and restrictions
users              (id, email UNIQUE, password_hash, role, display_name, avatar_url)
                   -- role: 'diner' | 'restaurant_admin' | 'superadmin'
user_restrictions  (id, user_id FK, restriction_type, ingredient_id FK nullable,
                    diet_type, severity)
                   -- restriction_type: 'allergy' | 'dislike' | 'diet'
                   -- severity: 'block' (allergy) | 'warn' (dislike)
restaurant_admins  (id, user_id FK, restaurant_id FK)  -- many:many
sessions           (id, user_id FK, expires_at)  -- Better Auth managed
```

---

# Key Components & Implementation Steps

## Step 0 — Monorepo Foundation

- Init pnpm workspace, Turborepo, TypeScript root config
- Create `packages/db` with all Drizzle schema tables
- Run `drizzle-kit migrate` against local PostgreSQL
- Create `packages/shared` with Zod schemas + enums
- **Critical files to create:** `pnpm-workspace.yaml`, `turbo.json`, `packages/db/src/schema/*.ts`

## Step 1 — Test Data Seeding

- Create `packages/seed/src/seed-test-data.ts` with a handful of sample ingredients for testing
- Include common allergens and dietary items (garlic, milk, peanuts, wheat, eggs, tree nuts, fish, shellfish, sesame, soy)
- Add ingredient aliases (e.g., "dairy" → milk)
- Upsert to `ingredients` table using Drizzle
- **Note:** Full USDA/Wikimedia food database ingestion deferred to Phase 2 — focus on API/UI first
- Expected test data: ~20–30 canonical ingredients with basic descriptions

## Step 2 — Fastify API Core

- Scaffold `apps/api` with Better Auth (Drizzle adapter), CORS, rate limiting
- Auth routes + role-guard middleware (diner / restaurant_admin / superadmin)
- `/ingredients?q=` search with `pg_trgm` fuzzy search — **unblocks admin portal ingredient tagging**
- Restaurant/menu/section/dish CRUD routes with auth guards
- `GET /menu/:restaurantSlug` aggregation endpoint — full menu in one call for diner app
- User restrictions CRUD (`/users/me/restrictions`)
- QR code PNG endpoint (`GET /restaurants/:id/qr`) using `qrcode` package
- Use Zod schemas from `packages/shared` for type-safe request/response validation

## Step 3 — Admin Portal (Vite + React)

Build order: auth pages → dashboard layout → restaurant profile → menu/section CRUD → dish CRUD → **ingredient tagging combobox** (most complex: debounced search + attach/detach chips) → menu publish toggle → QR code display → superadmin ingredient dictionary

## Step 4 — Diner App (Next.js 15)

Build order: menu server component (`app/r/[slug]/page.tsx`) → DishCard → **IngredientModal** (centerpiece: name, aliases, description, nutrients, allergen badge) → FilterPanel (localStorage for guests, API for logged-in) → `restriction-engine.ts` client-side matching logic → user auth + profile/restrictions editor → apply restriction status badges to DishCard

## Step 5 — Integration & Hardening

- QR code end-to-end test (Playwright): generate QR → scan URL → menu loads → ingredient modal works
- loading.tsx skeletons + error boundaries + not-found pages
- Zod validation on all API inputs (typed 422 responses)
- Optimistic updates in admin portal (React Query or SWR)
- Rate limiting on ingredient search endpoint

---

# Data Flow

```
Restaurant admin → creates menu → attaches ingredients (fuzzy search from dictionary)
         → publishes menu → QR code generated

Diner scans QR → /r/[slug] server renders full menu (one API call)
         → clicks ingredient chip → IngredientModal shows description/nutrients
         → if logged in: FilterPanel loads user restrictions
         → restriction-engine.ts compares dish ingredients vs. user restrictions
         → DishCard shows: safe / warn badge / blocked (grayed out)
```

---

# Constraints & Patterns

- **Testing:** >80% coverage with Vitest (unit/integration); Playwright for E2E QR flow
- **Styling:** Tailwind CSS + shadcn/ui components (source-owned, not a library dependency)
- **Security:** Better Auth sessions (HTTP-only cookies), role-guard middleware on all write routes, Zod input validation, rate limiting on search endpoints
- **Performance:** Next.js server components for initial menu render (no client-side loading spinner on QR scan), `pg_trgm` GIN indexes for sub-50ms ingredient search, Turborepo build cache
- **Data isolation:** Dish ingredients belong to the restaurant's dish instance — same dish name can have different ingredients at different restaurants (enforced by `dish_ingredients` pointing to `dish_id` not a canonical dish)
- **Ingredient dictionary:** Approved entries are the global dictionary. Restaurant admins may **request** new names (pending until superadmin approves); pending rows are excluded from other restaurants’ search until approved.

### Documentation workflow

- Whenever you implement or change an HTTP route in `apps/api` or a user-facing route in the admin portal, update `IMPLEMENTED_ROUTES.md` in the same change (or immediately after). This file is the canonical list of what exists today; `TECH_PLAN.md` stays high-level and does not duplicate every path.

---

# Open Questions

1. **Deployment target:** Single VPS (Docker Compose), managed PaaS (Railway/Render), or serverless (Vercel + Cloudflare Workers)? Affects Drizzle DB client config and image upload strategy.
2. **Restaurant onboarding:** Self-service sign-up or superadmin-provisioned? Self-service needs an onboarding flow + email verification.
3. **Ingredient "not found" flow:** When a restaurant admin types an ingredient not in the dictionary, what happens? (a) "Request ingredient" CTA → pending superadmin review, (b) allow admin to create local/unverified ingredients, or (c) dictionary-only, no tagging if not found?
4. **Wikimedia token validity:** The token at `data_resources/Wikimedia/token.txt` appears to be a Wikimedia Enterprise Cognito JWT. Is it still valid? Are there rate limits or cost implications for the seed pipeline?
5. **Allergen taxonomy:** Use FDA's 9 major allergens as canonical groups (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, sesame), or a custom taxonomy?

---

# Verification Plan

1. Run `drizzle-kit studio` after schema creation — verify all tables and relationships visible
2. Run seed pipeline against local DB — verify ingredients table populated with USDA data
3. Call `GET /ingredients?q=garlic` — verify fuzzy search returns results
4. Admin portal: create restaurant → menu → dish → tag ingredient — verify full flow
5. Diner app: navigate to `/r/[slug]` — verify server-rendered menu loads
6. Playwright E2E: generate QR → open URL → click ingredient → verify modal content
7. Add allergy restriction → navigate to menu → verify dish warning badges appear

