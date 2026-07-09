### Cursor Global Rules for `digital-menu`

These rules mirror the conventions in root `CLAUDE.md`, the canonical full project knowledge base (project goal, architecture, DB schema, features implemented, known gaps), plus `.claude/skills/*/SKILL.md` for deep dives (DB migrations - also see `.cursor/rules/drizzle-migrations.mdc`, AI chat architecture, seeding/ingredients, route catalog). Read `CLAUDE.md` for the full picture.

**If you change a convention here, also update `CLAUDE.md` and `AGENTS.md` in the same change so the three don't drift.**

---

#### 1. Project overview

- **Monorepo layout**
  - `apps/api`: Fastify 5 API server (port **3002** in local dev - see `CLAUDE.md` § Known gaps).
  - `apps/admin-portal`: Vite + React admin SPA.
  - `apps/diner-app`: Next.js 15 diner-facing app.
  - `packages/db`: Drizzle ORM schema + migrations.
  - `packages/shared`: Shared Zod schemas + TypeScript types/enums.
  - `packages/seed`: Ordered data-seeding scripts.

- **Core technologies**
  - **Validation**: Zod (schemas in `packages/shared`).
  - **Backend framework**: Fastify (DO NOT introduce Express).
  - **Testing**: Vitest (unit/integration) across all three apps.
  - **DB / Migrations**: Drizzle ORM + drizzle-kit. **Never hand-write** `packages/db/drizzle/*.sql` - edit `schema.ts`, run `drizzle:generate`, then `drizzle:migrate`. See `.cursor/rules/drizzle-migrations.mdc` and `.claude/skills/db-migration/SKILL.md`.

When in doubt, follow patterns already used in these folders before inventing new ones. See `CLAUDE.md` § Features implemented for current capability per app.

---

#### 2. Prompting & context rules

- Always refer to files by relative path from repo root.
- Prefer small, focused diffs over full-file rewrites unless a full refactor is explicitly requested.
- Identify existing helpers/utilities to reuse first; call out assumptions explicitly, then proceed with a sensible default rather than blocking on questions.

---

#### 3. Architecture & dependency rules

- `packages/*` must not depend on `apps/*`.
- `packages/shared` holds shared Zod schemas/types reused by backend and frontends.
- `apps/api` may depend only on `packages/db` and `packages/shared`.
- Use Zod schemas from `packages/shared` for request/response validation where possible.
- Keep route handlers thin where practical; push business rules into `lib/`/`services/` helpers as they grow (most CRUD routes today are still handler-only - existing norm, see `CLAUDE.md` § System design).
- Admin portal: React + shadcn/ui-style components + Tailwind. Diner app: Next.js 15 App Router, prefer server components for initial data fetch.

---

#### 4. Coding style & quality rules

- **Error handling**: consistent error objects (status + `error`, often a `code`); never leak raw errors; prefer early returns over deep nesting.
- **Configuration**: no centralized config module today - ad hoc `process.env` reads with inline defaults are the existing pattern; don't "fix" this unless asked.
- **Logging**: Fastify's built-in logger (Pino) for HTTP logs; the bespoke `lib/ai-chat-logger.ts` only for LLM call auditing. No ad hoc `console.log`.
- **Testing expectations**: add or extend Vitest tests for new/changed behavior, or explain why one isn't practical yet.

---

#### 5. Change scope rules

- State the allowed change scope for non-trivial tasks.
- Prefer minimal necessary changes; keep any incidental refactor tightly scoped and called out.
- Do **not** rename public APIs/shared types without explicit authorization, or introduce new top-level dependencies without being asked.

---

#### 6. Testing and verification rules

- Use Fastify's `inject` for API route tests, not a custom HTTP client.
- Mirror the current frontend testing approach (Testing Library + jsdom).
- Prefer extending existing test files over creating many small new ones.

---

#### 7. Helper and convention rules

- Search `packages/shared` and `apps/api/src/lib` for a suitable existing helper before adding a new one.
- Follow existing file naming/routing patterns in `apps/api/src/routes/*`.

---

#### 8. Documentation rules

There is no `PROGRESS.md`, `IMPLEMENTED_ROUTES.md`, or per-app `FEATURES.md` anymore. `CLAUDE.md` is the single knowledge base; `.claude/skills/api-routes/SKILL.md` is the route catalog. When you add/remove/change a route or ship a feature, update the relevant section of `CLAUDE.md` (and the route skill for route changes) **in the same change**. Current capability is whatever those files say - unmentioned means not implemented.

---

#### 9. Plan- and role-aware behavior

- When following a feature plan, obey the current step and don't jump ahead unless told to.
- Respect role prompts: Implementation → correct, minimal-code changes; Reviewer → critique, not rewrites; Testing → tests/verification, not implementation.
