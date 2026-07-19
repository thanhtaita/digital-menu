# Deployment, monitoring, rollback

This documents the **real current state**, not an aspirational target. As of 2026-07-18:

## Deployment

There is no deployment configuration of any kind - no Docker Compose, no Dockerfiles, no CI/CD pipeline,
no cloud infra-as-code, no hosting target defined anywhere in the repo. `apps/api`, `apps/admin-portal`,
and `apps/diner-app` are only ever run locally via `pnpm dev` (Turborepo `turbo dev`, per `package.json`).

Local dev also depends on a locally-reachable Postgres (`DATABASE_URL`, default
`postgres://postgres:123456@localhost:5433/digital_menu`) with the `fdc` reference schema optionally
loaded (see [`docs/architecture/fdc-reference-data.md`](../architecture/fdc-reference-data.md)). See
`SETUP.md` at the repo root for the full local environment runbook.

## Monitoring

None. Fastify's built-in Pino logger emits structured HTTP logs to stdout in `apps/api`; the bespoke
`lib/ai-chat-logger.ts` file-logger separately audits LLM calls. Neither is shipped anywhere - there is
no log aggregation, alerting, or dashboard.

## Rollback

Not applicable - there is nothing deployed to roll back. Locally, reverting is just `git revert`/`git
reset` plus, if a DB migration was involved, the recovery procedure in the `db-migration` skill
(`pnpm --filter @digital-menu/db db:reset` then re-migrate/reseed).

## When this needs to change

If/when real deployment infrastructure is added (a target platform, a Dockerfile, a CI/CD pipeline), that
choice is a decision with lasting rationale - write an ADR under `docs/decisions/` for it, then replace
this file's content with the real procedure. Don't let this file drift into describing infrastructure
that doesn't exist.
