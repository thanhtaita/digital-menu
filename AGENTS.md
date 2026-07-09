# Codex Rules for `digital-menu`

These rules mirror the conventions in root `CLAUDE.md`, which is the canonical, full project knowledge base (project goal, architecture, DB schema, features implemented, known gaps) plus `.claude/skills/*/SKILL.md` for deep dives (DB migrations, AI chat architecture, seeding/ingredients, route catalog). Read `CLAUDE.md` for the full picture; this file exists so Codex has the same conventions without needing that tool's skill system.

**If you change a convention here, also update `CLAUDE.md` and `.cursor/rules/global.md` in the same change so the three don't drift.**

---

## 1. Project overview

**Monorepo layout:**
- `apps/api` - Fastify 5 API server (port **3002** in local dev - see `CLAUDE.md` § Known gaps).
- `apps/admin-portal` - Vite + React admin SPA.
- `apps/diner-app` - Next.js 15 diner-facing app.
- `packages/db` - Drizzle ORM schema + migrations.
- `packages/shared` - Shared Zod schemas + TypeScript types/enums.
- `packages/seed` - Ordered data-seeding scripts.

**Core technologies:** Zod (validation, in `packages/shared`), Fastify (backend - do NOT introduce Express), Vitest (unit/integration tests in all three apps), Drizzle ORM + drizzle-kit (DB/migrations).

When in doubt, follow patterns already used in these folders before inventing new ones. See `CLAUDE.md` § Features implemented for what's already built in each app.

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
- Keep route handlers thin where practical; push business rules into `lib/`/`services/` helpers as they grow (most CRUD routes today are still handler-only - that's the existing norm, see `CLAUDE.md` § System design).

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

There is no `PROGRESS.md`, `IMPLEMENTED_ROUTES.md`, or per-app `FEATURES.md` anymore. `CLAUDE.md` is the single knowledge base; `.claude/skills/api-routes/SKILL.md` is the route catalog. When you add/remove/change a route or ship a feature, update the relevant section of `CLAUDE.md` (and `.claude/skills/api-routes/SKILL.md` for route changes) **in the same change**. Current capability is whatever those files say - unmentioned means not implemented.

---

## 10. Plan- and role-aware behavior

- When following a feature plan, obey the current step and don't jump ahead unless told to.
- Respect role prompts: Implementation → correct, minimal-code changes; Reviewer → critique, not rewrites; Testing → tests/verification, not implementation.

---

## Summary — priority order

1. Dependencies & architecture rules (§3) must not be violated.
2. DB migrations (§7) - always `schema.ts` → `drizzle:generate` → `drizzle:migrate`; never hand-write.
3. `CLAUDE.md` + the touched skill file(s) must stay in sync with code changes (§9).
4. Code style & testing should match existing patterns.
5. Scope discipline (§5).
