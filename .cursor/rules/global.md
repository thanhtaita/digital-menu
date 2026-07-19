### Cursor Global Rules for `digital-menu`

These rules mirror the conventions in root `CLAUDE.md`, a short orientation page pointing at the real
project knowledge base: **`docs/index.md`** (project goal, goals/features with per-feature READMEs, design
docs, and task logs, architecture docs, ADRs, operations docs, dated release notes), plus
`.claude/skills/*/SKILL.md` for deep dives (DB migrations - also see `.cursor/rules/drizzle-migrations.mdc`,
AI chat architecture, seeding/ingredients, route catalog). Read `docs/index.md` for the full picture.

**If you change a convention here, also update `CLAUDE.md` and `AGENTS.md` in the same change so the three don't drift.**

---

#### 1. Project overview

- **Monorepo layout**
  - `apps/api`: Fastify 5 API server (port **3002** in local dev - see `docs/decisions/ADR-002-local-dev-api-port-default.md`).
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

When in doubt, follow patterns already used in these folders before inventing new ones. See `docs/index.md` for current capability per app.

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
- Keep route handlers thin where practical; push business rules into `lib/`/`services/` helpers as they grow (most CRUD routes today are still handler-only - existing norm, see `docs/architecture/system-overview.md`).
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

Project knowledge lives in `docs/` (see `docs/index.md`), not in a single flat file - see
`docs/decisions/ADR-001-structured-docs-system.md` for why. Each fact has exactly one canonical home; a
generated rollup (`docs/TASKLOGGING.md`, via `pnpm docs:tasklog`) aggregates history without anyone
hand-maintaining a second copy of it. `CLAUDE.md` is a short orientation pointer, not the knowledge base
itself.

**Which doc to touch, by kind of change** - the actual enforcement mechanism, read before finishing any
task that touches code or project knowledge:

- Any feature-level change (new feature or a nontrivial extension of one): find or create its
  `docs/goals/<goal>/features/<feature>/` folder. Always append a `task-log.md` entry - that's the
  mandatory minimum for anything worth documenting. Update `README.md`/`design.md` if user-facing behavior
  or the technical approach changed.
- Architecture/system-design change (new subsystem, changed data flow, new integration): update the
  matching `docs/architecture/*.md` file, or add one.
- A decision with lasting rationale (a tradeoff, a rejected alternative, a convention change): add an ADR
  under `docs/decisions/`.
- Operational change (deployment, monitoring, rollback procedure): update `docs/operations/*.md`.
- Trivial changes (typo fixes, pure refactors with no behavior change): no doc update required, but when
  in doubt add at least a one-line `task-log.md` entry.
- Regenerate `docs/TASKLOGGING.md` (`pnpm docs:tasklog`) whenever any `task-log.md` changed, before
  finishing the task, and commit it in the same change. Never hand-edit `docs/TASKLOGGING.md` itself.
- Adding a new goal or feature folder: link it from `docs/index.md` and its goal's `README.md`.
- Route changes specifically also update `.claude/skills/api-routes/SKILL.md`, the route catalog - that
  skill file is unaffected by this restructure.

Current capability is whatever `docs/index.md` and the linked goal/feature docs say - unmentioned means
either not implemented, or shipped before this docs system and not yet backfilled.

---

#### 9. Plan- and role-aware behavior

- When following a feature plan, obey the current step and don't jump ahead unless told to.
- Respect role prompts: Implementation → correct, minimal-code changes; Reviewer → critique, not rewrites; Testing → tests/verification, not implementation.
