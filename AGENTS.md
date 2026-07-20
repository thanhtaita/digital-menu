# Codex Rules for `digital-menu`

These rules mirror the conventions in root `CLAUDE.md`, a short orientation page pointing at the real
project knowledge base: **`docs/index.md`** (project goal, goals/features with per-feature READMEs, design
docs, and task logs, architecture docs, ADRs, operations docs, dated release notes) plus
`.claude/skills/*/SKILL.md` for deep dives (DB migrations, AI chat architecture, seeding/ingredients, route
catalog). Read `docs/index.md` for the full picture; this file exists so Codex has the same conventions
without needing that tool's skill system.

**If you change a convention here, also update `CLAUDE.md` and `.cursor/rules/global.md` in the same change so the three don't drift.**

---

## 1. Project overview

**Monorepo layout:**
- `apps/api` - Fastify 5 API server (port **3002** in local dev - see `docs/decisions/ADR-002-local-dev-api-port-default.md`).
- `apps/admin-portal` - Vite + React admin SPA.
- `apps/diner-app` - Next.js 15 diner-facing app.
- `packages/db` - Drizzle ORM schema + migrations.
- `packages/shared` - Shared Zod schemas + TypeScript types/enums.
- `packages/seed` - Ordered data-seeding scripts.

**Core technologies:** Zod (validation, in `packages/shared`), Fastify (backend - do NOT introduce Express), Vitest (unit/integration tests in all three apps), Drizzle ORM + drizzle-kit (DB/migrations).

When in doubt, follow patterns already used in these folders before inventing new ones. See `docs/index.md` for what's already built in each app.

---

## 2. Prompting & context rules

- Always refer to files by relative path from repo root.
- Prefer small, focused diffs over full-file rewrites unless a full refactor is explicitly requested.
- Identify existing helpers/utilities to reuse before writing new ones.
- If scope is ambiguous but a safe assumption exists, state the assumption and continue instead of blocking on questions.

---

## 3. Architecture & dependency rules

- `packages/*` must never depend on `apps/*`.
- `packages/shared` holds shared Zod schemas/types reused by backend and frontends.
- `apps/api` may depend only on `packages/db` and `packages/shared`.
- Use Zod schemas from `packages/shared` for request/response validation.
- Keep route handlers thin where practical; push business rules into `lib/`/`services/` helpers as they grow (most CRUD routes today are still handler-only - that's the existing norm, see `docs/architecture/system-overview.md`).

---

## 4. Coding style & quality rules

- **Error handling:** consistent error objects (status + `error`, often a `code`); never leak raw errors; prefer early returns over deep nesting.
- **Configuration:** there's no centralized config module today - ad hoc `process.env` reads with inline defaults are the existing pattern (see `lib/ai/config.ts`); don't "fix" this unless asked.
- **Logging:** Fastify's built-in logger (Pino) for HTTP logs; the bespoke `lib/ai-chat-logger.ts` only for LLM call auditing. No ad hoc `console.log`.
- **Testing:** add or extend Vitest tests when changing behavior, or explain why one isn't practical yet.

---

## 5. Change scope rules

- State the allowed change scope for non-trivial tasks.
- Prefer minimal necessary changes; keep any incidental refactor tightly scoped and called out.
- Do NOT rename public APIs or shared types without explicit authorization, or introduce new top-level dependencies without being asked.

---

## 6. Testing and verification rules

- Use Fastify's `inject` (not a custom HTTP client) for API route tests.
- Mirror the current frontend testing approach (Testing Library + jsdom).
- Prefer extending existing test files over creating many small new ones.
- **Promotion rule:** verify behavior interactively while building (manual `inject` calls, browser
  checks), but before calling a change done, promote anything that represents a real behavior contract
  into a committed, automated test - a manual check paid for once is cheaper than one silently re-paid on
  every future change.
- **Target shape:** a pyramid. Most coverage stays in fast Vitest unit tests (current strength - keep as
  is); a thinner layer of integration tests exercises real component boundaries instead of mocks; a thin
  top layer of end-to-end tests is reserved for the handful of critical user journeys.
- **Known gap - API/DB boundary:** `apps/api/src/__tests__` mocks Drizzle/Postgres at the module boundary
  (`vi.mock("../lib/db.js", ...)`), which structurally can't catch real SQL/schema drift. Documented
  target, not yet built: a small integration suite that runs real queries against a throwaway test
  Postgres instance (e.g. testcontainers), reserved for the boundary-sensitive paths where mocked coverage
  is riskiest.
- **Known gap - no e2e tier:** there is no Playwright (or equivalent) suite today, despite
  `apps/diner-app` (Next.js) and `apps/admin-portal` (Vite/React-Router) both being Playwright-compatible.
  Documented target, not yet built: a thin Playwright suite covering the diner ordering flow and the admin
  menu-builder flow, kept intentionally small given e2e's cost/flakiness tradeoff.

---

## 7. DB schema and migration rules

**Drizzle owns migrations.** Full procedure and a worked cautionary example (the "0009 incident") live in `.claude/skills/db-migration/SKILL.md`. Summary:

1. Edit `packages/db/src/schema/schema.ts` only.
2. `pnpm --filter @digital-menu/db drizzle:generate` - never hand-write `packages/db/drizzle/*.sql` or edit `meta/_journal.json`/`meta/*_snapshot.json` by hand.
3. Commit the generated SQL + journal + snapshot together.
4. `pnpm --filter @digital-menu/db drizzle:migrate` (same `DATABASE_URL` as `apps/api`).
5. Verify: new tables/columns exist AND a new row appears in `drizzle.__drizzle_migrations`. Don't trust "success" output alone.

Local recovery: `pnpm --filter @digital-menu/db db:reset`, then migrate (and reseed if needed) - see `SETUP.md`.

---

## 8. Helper and convention rules

- Search `packages/shared` and `apps/api/src/lib` for an existing helper before adding a new one.
- Follow existing file naming/routing patterns in `apps/api/src/routes/*`.

---

## 9. Documentation rules

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
either not implemented, or shipped before this docs system and not yet backfilled (see `docs/index.md`'s
"Goals" section for the backfill boundary).

---

## 10. Plan- and role-aware behavior

- When following a feature plan, obey the current step and don't jump ahead unless told to.
- Respect role prompts: Implementation → correct, minimal-code changes; Reviewer → critique, not rewrites; Testing → tests/verification, not implementation.

---

## Summary — priority order

1. Dependencies & architecture rules (§3) must not be violated.
2. DB migrations (§7) - always `schema.ts` → `drizzle:generate` → `drizzle:migrate`; never hand-write.
3. `docs/` (task-log at minimum, plus the touched skill file(s)) must stay in sync with code changes (§9).
4. Code style & testing should match existing patterns.
5. Scope discipline (§5).

---

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
