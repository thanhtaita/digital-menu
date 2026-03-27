### Cursor Global Rules for `digital-menu`

These rules tell Cursor how to work in this repo so development stays fast, safe, and consistent.

---

#### 1. Project overview

- **Monorepo layout**
  - `apps/api`: Fastify API server (TypeScript).
  - `apps/admin-portal`: Vite + React admin SPA.
  - `apps/diner-app`: Next.js 15 diner-facing app.
  - `packages/db`: Drizzle ORM schema + migrations.
  - `packages/shared`: Shared Zod schemas + TypeScript types/enums.
  - `packages/seed`: Data ingestion / seeding scripts.

- **Core technologies**
  - **Validation**: Zod (schemas in `packages/shared`).
  - **Backend framework**: Fastify (DO NOT introduce Express).
  - **Testing**: Vitest (unit/integration), Playwright (E2E).
  - **DB / Migrations**: Drizzle ORM + drizzle-kit.

When in doubt, follow patterns already used in these folders before inventing new ones.

---

#### 2. Prompting & context rules

- Always refer to files by **relative path from repo root**, e.g. `apps/api/src/routes/auth.ts`.
- Prefer **small, focused diffs** over full-file rewrites unless the user explicitly asks for a full refactor.
- When making non-trivial changes, first:
  - Identify any existing helpers / utilities that should be reused.
  - Call out assumptions explicitly in the explanation, then proceed with a sensible default.
- If scope is ambiguous but a safe assumption exists, **state the assumption and continue** instead of blocking on questions.

---

#### 3. Architecture & dependency rules

- **Dependency direction**
  - `packages/*` must not depend on `apps/*`.
  - `packages/shared` should hold shared Zod schemas and types that are reused by both backend and frontends.
  - API code in `apps/api` may depend on `packages/db` and `packages/shared` only.
- **API design**
  - Use Zod schemas from `packages/shared` for request/response validation where possible.
  - Keep route handlers thin; push business rules into small, testable functions (`lib/` or helpers).
- **Frontends**
  - Admin portal: React + shadcn/ui + Tailwind; follow patterns that will be established in `apps/admin-portal/src`.
  - Diner app: Next.js 15 App Router; prefer server components for initial data fetch where possible.

---

#### 4. Coding style & quality rules

- **Error handling**
  - For API routes, return consistent error objects (status + `message` or structured error body), do **not** leak raw errors.
  - Prefer early returns and clear branching over deeply nested conditionals.
- **Configuration**
  - Centralize env/config access in dedicated modules (e.g. a `config` helper) instead of calling `process.env` from many places.
- **Logging**
  - Use a single logging approach (e.g. Fastify logger) instead of ad-hoc `console.log` sprinkled everywhere.
- **Testing expectations**
  - New features should add or extend **Vitest** tests where practical.
  - Critical flows (auth, menu fetch, restrictions) should eventually have integration/E2E coverage, but unit tests are acceptable for initial iterations.

---

#### 5. Change scope rules

- Every task description **must state the allowed change scope**, for example:
  - “Only modify `apps/api/src/routes/menus.ts` and related Zod schemas in `packages/shared`.”
- Within that scope:
  - Prefer minimal necessary changes over wide refactors.
  - If a small refactor is needed for clarity, keep it tightly scoped and call it out explicitly.
- Do **not**:
  - Rename public APIs or shared types unless the user explicitly authorizes a breaking change.
  - Introduce new top-level dependencies without being asked to; reuse existing stack first.

---

#### 6. Testing and verification rules

- When changing behavior:
  - Either add at least one test or explain why a test is not added yet (e.g., no test harness exists for that area).
  - Prefer extending existing test files over creating many small new ones.
- For backend HTTP routes:
  - Use the project’s chosen testing tools (e.g. Vitest + `supertest` or Fastify’s inject API) instead of custom HTTP clients.
- For frontends:
  - Mirror the current testing approach once it exists (React Testing Library, Playwright, etc.).

---

#### 7. Helper and convention rules

- Before introducing a new helper or abstraction:
  - Search `packages/shared` and `apps/api/src/lib` (or future helper locations) for a suitable existing function or pattern.
  - If a new helper is justified, keep it small and generic enough to be reusable, and place it in the appropriate shared location.
- For API routes:
  - Follow file naming and routing patterns already present in `apps/api/src/routes/*`.
  - Keep validation and type definitions close to where they are used, or in `packages/shared` if shared across apps.

---

#### 8. Route documentation (`IMPLEMENTED_ROUTES.md`) & progress (`PROGRESS.md`)

- **`PROGRESS.md`** (repo root) summarizes **what is done vs next** against `TECH_PLAN.md`. Update it when you complete a plan milestone or change priorities; use it with `TECH_PLAN.md` for sequencing work.
- The **canonical list** of implemented HTTP API routes and admin-portal (and diner-app, when applicable) **page routes** lives in **`IMPLEMENTED_ROUTES.md`** at the repo root.
- Whenever you **add**, **remove**, or **meaningfully change** a route—e.g. new Fastify handler (`apps/api`), new React Router path, changed method or prefix—**update `IMPLEMENTED_ROUTES.md` in the same change** (or immediately after), using the same format as existing entries (method + path, short notes on auth or query params).
- Do not leave the catalog outdated after implementing routes; treat it as part of the definition of done for route work.

---

#### 9. Plan- and role-aware behavior

- When the user references a **feature plan**:
  - Obey the current step and do not jump ahead unless explicitly instructed.
  - Update explanations so the user can easily mark plan items as done or adjusted.
- Respect role prompts:
  - Implementation role → focus on correct, minimal-code changes within scope.
  - Reviewer role → focus on critique and suggestions, not rewriting entire files.
  - Testing role → focus on tests and verification, not implementation changes.

