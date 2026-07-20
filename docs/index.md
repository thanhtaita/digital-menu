# digital-menu — docs index

This is the entry point into the project's knowledge base. `CLAUDE.md` at the repo root is now a short
orientation page that points here plus at `.claude/skills/*/SKILL.md`; this file and everything it links
to is where the real, evolving project knowledge lives. See
[`docs/decisions/ADR-001-structured-docs-system.md`](./decisions/ADR-001-structured-docs-system.md) for
why this structure replaced the old flat `CLAUDE.md` convention.

## Project goal

A multi-tenant restaurant menu platform: restaurant admins build menus and tag dishes with ingredients
from a shared global dictionary; diners browse menus with allergy/diet-aware warnings, follow a social
layer (posts/follows/feed), and get LLM-driven conversational dish recommendations through an AI chat
assistant.

## Goals

Product-facing and platform work is organized into goals, each with its own features:

- [`goals/dietary-safety-and-nutrition/`](./goals/dietary-safety-and-nutrition/README.md) - allergy/diet-aware
  dish warnings and real nutrition data, built on the shared ingredient dictionary.
- [`goals/restaurant-admin-portal/`](./goals/restaurant-admin-portal/README.md) - restaurant-admin-facing
  tooling in `apps/admin-portal` for running a restaurant's menu day-to-day.
- [`goals/platform-hardening/`](./goals/platform-hardening/README.md) - cross-cutting reliability/abuse
  protection that isn't itself a user-facing feature.
- [`goals/diner-discovery/`](./goals/diner-discovery/README.md) - diner-facing ways to find food across the
  whole platform, starting with platform-wide search.

Only features backfilled since this docs system was introduced (2026-07-18) have full
`README.md`/`design.md`/`task-log.md` folders. Capability that predates this system - the ingredient
dictionary and its approval workflow, translations, the social layer, the AI chat assistant, pgvector
recommendations, auth, menu/dish CRUD, and more - is real and shipped, but is currently documented only in
`docs/architecture/*.md` (birds-eye) and `.claude/skills/*/SKILL.md` (deep dives), not backfilled into a
goal/feature folder. Add one the next time any of that capability changes nontrivially, per the
enforcement contract in `CLAUDE.md`.

## Architecture

Birds-eye system docs. For implementation depth on a specific subsystem, follow the links from these into
`.claude/skills/*/SKILL.md` rather than expecting full detail here.

- [`architecture/system-overview.md`](./architecture/system-overview.md) - monorepo structure, multi-tenancy,
  auth, route-handler conventions, the AI provider abstraction, rate limiting.
- [`architecture/data-model.md`](./architecture/data-model.md) - database schema by domain.
- [`architecture/fdc-reference-data.md`](./architecture/fdc-reference-data.md) - the USDA FoodData Central
  reference schema (`fdc.*`) and how `public.ingredients` backfills from it.
- [`architecture/known-gaps.md`](./architecture/known-gaps.md) - standing rough edges that are real but
  don't (yet) warrant their own ADR.

## Decisions

Durable architectural decisions with lasting rationale, one file per decision:

- [`decisions/ADR-001-structured-docs-system.md`](./decisions/ADR-001-structured-docs-system.md) - this
  docs system itself, replacing the flat `CLAUDE.md` convention.
- [`decisions/ADR-002-local-dev-api-port-default.md`](./decisions/ADR-002-local-dev-api-port-default.md) -
  standardizing local-dev API port references on 3002.
- [`decisions/ADR-003-postgres-search-not-dedicated-engine.md`](./decisions/ADR-003-postgres-search-not-dedicated-engine.md) -
  platform-wide search stays inside Postgres (`pg_trgm`), no dedicated search engine.

## Operations

- [`operations/deployment.md`](./operations/deployment.md) - deployment/monitoring/rollback, documented as
  it really is today (local dev only - no deployment config exists yet).

## Releases

One file per date something merged to local `main`, summarizing what shipped:

- [`releases/2026-07-11.md`](./releases/2026-07-11.md) - FDC nutrition backfill.
- [`releases/2026-07-12.md`](./releases/2026-07-12.md) - QR code display, rate limiting, diet-type
  restrictions.

## Task log

[`TASKLOGGING.md`](./TASKLOGGING.md) is a **generated** flat chronological rollup of every feature's
`task-log.md`, produced by `scripts/gen-tasklog.mjs` (`pnpm docs:tasklog`). Never hand-edit it - edit the
source `task-log.md` and regenerate.

## Where to look elsewhere

- `.claude/skills/*/SKILL.md` - deep, on-demand reference/procedural knowledge (DB migrations, AI chat
  architecture, seed/ingredient data, HTTP/page route catalog, recommendation embeddings). The skills index
  in `CLAUDE.md` lists which skill to load for which kind of task.
- `SETUP.md` - human/agent environment setup runbook (kept standalone, not project knowledge).
- `docs/cursor/*.md` - unrelated Cursor prompt templates, not part of this docs system.
