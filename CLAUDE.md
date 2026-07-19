# digital-menu — agent orientation

This file is a short orientation page, not the project knowledge base. The real, evolving knowledge base
is **[`docs/index.md`](./docs/index.md)** - project goal, goals/features with per-feature READMEs, design
docs, and task logs, architecture docs, ADRs, operations docs, and dated release notes - plus
`.claude/skills/*/SKILL.md` (see the [Skills index](#skills-index) below) for deep, on-demand reference and
procedural knowledge on specific subsystems. This file only keeps the two things below: agent-operating
conventions (not project knowledge) and the skills index.

Before making any change, or when picking up an unfamiliar part of the codebase, read `docs/index.md`
first - it links into everything else. See
[`docs/decisions/ADR-001-structured-docs-system.md`](./docs/decisions/ADR-001-structured-docs-system.md)
for why the old flat-`CLAUDE.md` convention was replaced with this structure, and read the "Which doc to
touch" contract below before finishing any change.

## Which doc to touch, by kind of change

This is the enforcement mechanism - read it before finishing any task that touches code or project
knowledge, not just at the start:

- **Any feature-level change** (new feature or a nontrivial extension of one): find or create its
  `docs/goals/<goal>/features/<feature>/` folder. Always append a `task-log.md` entry - that's the
  mandatory minimum for anything worth documenting. Update `README.md`/`design.md` if user-facing behavior
  or the technical approach changed.
- **Architecture/system-design change** (new subsystem, changed data flow, new integration): update the
  matching `docs/architecture/*.md` file, or add one.
- **A decision with lasting rationale** (a tradeoff, a rejected alternative, a convention change): add an
  ADR under `docs/decisions/`.
- **Operational change** (deployment, monitoring, rollback procedure): update `docs/operations/*.md`.
- **Trivial changes** (typo fixes, pure refactors with no behavior change): no doc update required, but
  when in doubt add at least a one-line `task-log.md` entry.
- **Regenerate `docs/TASKLOGGING.md`** (`pnpm docs:tasklog`) whenever any `task-log.md` changed, before
  finishing the task, and commit it in the same change. Never hand-edit `docs/TASKLOGGING.md` itself.
- **Adding a new goal or feature folder**: link it from `docs/index.md` and its goal's `README.md`.

**If you change a convention in this section, also update `AGENTS.md` §9 and `.cursor/rules/global.md` in
the same change so the three don't drift** (this rule is itself stated at the top of `AGENTS.md`).

## Conventions & rules

- **Paths**: always refer to files relative to repo root.
- **Diffs**: prefer small, focused diffs over full-file rewrites unless a full refactor is explicitly requested.
- **Dependency direction**: `packages/*` must never depend on `apps/*`; `apps/api` depends only on `packages/db` + `packages/shared`.
- **API design**: use Zod schemas from `packages/shared` for request/response validation; keep route handlers thin, push business rules into `lib/`/`services/` helpers when they grow (see `docs/architecture/system-overview.md` for the current baseline - most CRUD routes are still handler-only, that's the existing norm, not a violation).
- **Error handling**: consistent error objects (status + `error` message, often a `code`); never leak raw errors; prefer early returns over deep nesting.
- **Configuration**: there's no centralized config module today (ad hoc `process.env` reads are the existing pattern) - don't block on "fixing" this unless asked; if you add a new env var, follow the existing inline-default style used in `lib/ai/config.ts` / `lib/uploads.ts`.
- **Logging**: Fastify's built-in logger (Pino) for HTTP-level logs; the bespoke `lib/ai-chat-logger.ts` file-logger only for LLM call auditing. Don't sprinkle ad hoc `console.log`.
- **Change scope**: stay within the stated/implied scope; don't rename public APIs or shared types without explicit authorization; don't add new top-level dependencies without being asked - reuse the existing stack first.
- **Testing**: Vitest everywhere (unit + Fastify `inject`-based route tests in `apps/api`; Testing Library + jsdom in the frontends). Extend existing test files over creating many small new ones; add a test for new behavior or explain why one isn't practical yet.
- **Helper reuse**: before adding a new helper, search `packages/shared` and `apps/api/src/lib` for an existing one first.
- **Plan/role awareness**: when following a feature plan, obey the current step and don't jump ahead unless told to; when given a role (Implementation/Reviewer/Testing), stay in that lane.

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
