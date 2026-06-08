# Claude Rules for `digital-menu`

These rules ensure Claude Code follows consistent patterns and maintains the integrity of this monorepo.

---

## 1. Project Overview

**Monorepo layout:**
- `apps/api`: Fastify API server (TypeScript); **`FEATURES.md`** summarizes implemented API capabilities (keep in sync when behavior changes).
- `apps/admin-portal`: Vite + React admin SPA; **`FEATURES.md`** for admin UI capabilities.
- `apps/diner-app`: Next.js 15 diner-facing app; **`FEATURES.md`** for public diner experience.
- `packages/db`: Drizzle ORM schema + migrations.
- `packages/shared`: Shared Zod schemas + TypeScript types/enums.
- `packages/seed`: Data ingestion / seeding scripts.

**Core technologies:**
- **Validation**: Zod (schemas in `packages/shared`).
- **Backend framework**: Fastify (do NOT introduce Express).
- **Testing**: Vitest (unit/integration), Playwright (E2E).
- **DB / Migrations**: Drizzle ORM + drizzle-kit.

When in doubt, follow patterns already used in these folders before inventing new ones.

---

## 2. Prompting & Context Rules

- Always refer to files by **relative path from repo root**, e.g. `apps/api/src/routes/auth.ts`.
- Prefer **small, focused diffs** over full-file rewrites unless the user explicitly asks for a full refactor.
- When making non-trivial changes, first:
  - Identify any existing helpers / utilities that should be reused.
  - Call out assumptions explicitly in the explanation, then proceed with a sensible default.
- If scope is ambiguous but a safe assumption exists, **state the assumption and continue** instead of blocking on questions.

---

## 3. Architecture & Dependency Rules

**Dependency direction:**
- `packages/*` must not depend on `apps/*`.
- `packages/shared` should hold shared Zod schemas and types reused by both backend and frontends.
- API code in `apps/api` may depend on `packages/db` and `packages/shared` only.

**API design:**
- Use Zod schemas from `packages/shared` for request/response validation where possible.
- Keep route handlers thin; push business rules into small, testable functions (`lib/` or helpers).

**Frontends:**
- Admin portal: React + shadcn/ui + Tailwind; follow established patterns in `apps/admin-portal/src`.
- Diner app: Next.js 15 App Router; prefer server components for initial data fetch where possible.

---

## 4. Coding Style & Quality Rules

**Error handling:**
- For API routes, return consistent error objects (status + `message` or structured error body); do NOT leak raw errors.
- Prefer early returns and clear branching over deeply nested conditionals.

**Configuration:**
- Centralize env/config access in dedicated modules (e.g. a `config` helper) instead of calling `process.env` from many places.

**Logging:**
- Use a single logging approach (e.g. Fastify logger) instead of ad-hoc `console.log` sprinkled everywhere.

**Testing expectations:**
- New features should add or extend **Vitest** tests where practical.
- Critical flows (auth, menu fetch, restrictions) should eventually have integration/E2E coverage, but unit tests are acceptable for initial iterations.

---

## 5. Change Scope Rules

- Every task description **must state the allowed change scope**, for example:
  - "Only modify `apps/api/src/routes/menus.ts` and related Zod schemas in `packages/shared`."
- Within that scope:
  - Prefer minimal necessary changes over wide refactors.
  - If a small refactor is needed for clarity, keep it tightly scoped and call it out explicitly.
- Do NOT:
  - Rename public APIs or shared types unless the user explicitly authorizes a breaking change.
  - Introduce new top-level dependencies without being asked; reuse existing stack first.

---

## 6. Testing and Verification Rules

- When changing behavior:
  - Either add at least one test or explain why a test is not added yet (e.g., no test harness exists for that area).
  - Prefer extending existing test files over creating many small new ones.
- For backend HTTP routes:
  - Use the project's chosen testing tools (e.g. Vitest + `supertest` or Fastify's inject API) instead of custom HTTP clients.
- For frontends:
  - Mirror the current testing approach once it exists (React Testing Library, Playwright, etc.).

---

## 7. DB Schema and Migration Rules

**Drizzle owns migrations.** When adding or changing tables/columns/indexes:

1. Edit `packages/db/src/schema/schema.ts`.
2. Run `pnpm --filter @digital-menu/db drizzle:generate` — never hand-write `packages/db/drizzle/*.sql` or manually edit `packages/db/drizzle/meta/_journal.json`.
3. Commit generated SQL + journal (+ snapshot files produced by generate).
4. Run `pnpm --filter @digital-menu/db drizzle:migrate` (same `DATABASE_URL` as `apps/api`).
5. Verify new tables exist and `drizzle.__drizzle_migrations` has a new SHA-256 hash row.

**Do not:** create tables via raw SQL in a DB client, or write migration files yourself — that desyncs tracking and can block later migrations.

**Local recovery:** `pnpm --filter @digital-menu/db db:reset` then migrate (and seed if needed). See `SETUP.md`.

`meta/*_snapshot.json` files are for `drizzle:generate` only; `meta/_journal.json` is what `drizzle:migrate` reads.

---

## 8. Helper and Convention Rules

- Before introducing a new helper or abstraction:
  - Search `packages/shared` and `apps/api/src/lib` (or future helper locations) for a suitable existing function or pattern.
  - If a new helper is justified, keep it small and generic enough to be reusable, and place it in the appropriate shared location.
- For API routes:
  - Follow file naming and routing patterns already present in `apps/api/src/routes/*`.
  - Keep validation and type definitions close to where they are used, or in `packages/shared` if shared across apps.

---

## 9. Documentation: Routes, Per-App Features, Progress

- **`PROGRESS.md`** (repo root) summarizes what is done vs next against `TECH_PLAN.md`. Update it when completing a plan milestone or changing priorities.
- The **canonical list** of implemented HTTP API routes and admin-portal (and diner-app) **page routes** lives in **`IMPLEMENTED_ROUTES.md`** at the repo root.
- Whenever you **add**, **remove**, or **meaningfully change** a route (e.g., new Fastify handler, new React Router path, changed method or prefix), **update `IMPLEMENTED_ROUTES.md` in the same change**, using the same format as existing entries (method + path, short notes on auth or query params).
- Do not leave the catalog outdated after implementing routes; treat it as part of the definition of done for route work.

**Per-app feature summaries** (concise, human-readable behavior):

- **`apps/api/FEATURES.md`** — Update when API **capabilities** change: new route groups, auth rules, upload behavior, public vs private behavior, etc.
- **`apps/admin-portal/FEATURES.md`** — Update when the admin UI gains or loses **user-visible flows** (screens, CRUD, toggles, uploads, superadmin-only areas).
- **`apps/diner-app/FEATURES.md`** — Update when the public diner experience changes (pages, menu layout, ingredient modal, discovery list, etc.).

When you ship work that touches one of those apps, **update the matching `FEATURES.md` in the same change**: add/adjust/remove bullets so the file still matches reality. Keep entries short and outcome-focused. Point to `IMPLEMENTED_ROUTES.md` for exact paths and `PROGRESS.md` for planned gaps.

---

## 10. Plan- and Role-Aware Behavior

- When the user references a **feature plan**:
  - Obey the current step and do not jump ahead unless explicitly instructed.
  - Update explanations so the user can easily mark plan items as done or adjusted.
- Respect role prompts:
  - **Implementation role** → focus on correct, minimal-code changes within scope.
  - **Reviewer role** → focus on critique and suggestions, not rewriting entire files.
  - **Testing role** → focus on tests and verification, not implementation changes.

---

## Summary

Follow these rules in order of priority:
1. **Dependencies & architecture** must not be violated.
2. **DB migrations** — always `schema.ts` → `drizzle:generate` → `drizzle:migrate`; never hand-write migration SQL (§7).
3. **Documentation files** (`PROGRESS.md`, `IMPLEMENTED_ROUTES.md`, per-app `FEATURES.md`) must stay in sync with code changes.
4. **Code style & testing** should match existing patterns in the repo.
5. **Scope discipline** — stay within the change scope unless explicitly told otherwise.
