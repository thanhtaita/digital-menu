# ADR-004: Deployment platform - Neon + Render + Vercel Hobby

**Status:** Accepted
**Date:** 2026-07-25

## Context

`docs/operations/deployment.md` documented "no deployment configuration exists" - the project only ever
ran locally via `pnpm dev`. A research report (captain-approved, see `data/deploy-plan-h2/report.md` in
the task history that produced this ADR) surveyed hosting options for the three deployable pieces -
Postgres, the `apps/api` Fastify service, and the two frontends (`apps/admin-portal` Vite SPA,
`apps/diner-app` Next.js 15 SSR) - against two hard architectural constraints found by reading the code,
not assuming it:

- `apps/api/src/index.ts` runs a genuine long-lived Fastify process (`app.listen(...)`) with a single
  module-level `pg.Pool` (`apps/api/src/lib/db.ts`), created once per process and reused. This wants a
  persistent container, not a serverless function platform.
- `apps/api/src/routes/ai-chat.ts` streams AI chat responses via `reply.hijack()` + raw SSE `write()`,
  needing a host that keeps long HTTP connections open without buffering or killing them.

The goal was the lowest-cost hosting that fits both constraints, for a low-traffic demo phase, without
forcing an architecture rewrite.

## Decision

- **Postgres → Neon** (free tier). Real always-on free tier that autosuspends after 5 minutes of
  inactivity and **auto-resumes on the next query with no manual step**.
- **`apps/api` → Render** free Web Service. The only free host evaluated that runs a genuine persistent
  Node process (not a serverless function platform) - matches the `pg.Pool` + SSE-hijack architecture
  with zero code changes.
- **`apps/admin-portal` → Vercel** Hobby. Trivial static Vite build; native Turborepo/monorepo support.
- **`apps/diner-app` → Vercel** Hobby. Vercel is Next.js's own platform - best SSR fit and fastest cold
  starts of anything evaluated for a per-request SSR app with no API routes of its own.

Total steady-state cost: **$0/month**, with a smooth (non-rearchitecting) upgrade path once free-tier
limits are hit - see `docs/operations/deployment.md`'s "Graduation path" section.

## Alternatives considered and rejected

| Alternative | Verdict | Why |
|---|---|---|
| Railway (API) | Rejected for now, viable paid fallback | Free tier is gone in practice - the $1/mo trial tier can't hold a service + DB; real usage needs Hobby, $5/mo minimum plus metered usage. Worth revisiting if Render's free-tier ceiling (512 MB RAM, ephemeral disk, single instance) is too tight. |
| Fly.io (API) | Rejected | No free tier since 2024; pure pay-as-you-go, ~$2-25/mo for this size. |
| Supabase (Postgres) | Rejected in favor of Neon | Comparable free limits on paper, but free-project pausing after 7 days of inactivity requires a **human to click Restore in the dashboard** - wrong shape for an unattended, sparsely-visited demo. Neon's 5-minute autosuspend resumes itself on the next connection. Supabase's extra platform surface (auth, storage, realtime) is also unused here - the app has its own bespoke session auth. |
| Render's own free Postgres | Rejected | Fixed 1 GB storage, but **expires 30 days after creation** with only a 14-day grace window before deletion - not durable enough to be "the" database for something meant to keep working unattended. |
| Vercel (for the API) | Rejected | Vercel is a serverless-function platform. Porting the API's persistent `pg.Pool` + hijacked-raw-socket SSE stream to Vercel Functions would mean rewriting connection handling (a client per invocation, or adopting Neon's pooler to survive many short-lived concurrent connections) and re-verifying the chat stream against Vercel's function-duration limits - a rearchitecture, not a config change, and not worth it just to reach $0 when Render gets there with zero code changes. |
| Cloudflare Pages (frontends) | Considered, not chosen | Genuinely free, unlimited bandwidth, explicitly commercial-use-friendly - a legitimate alternative to Vercel for `admin-portal` specifically (pure static). Not used for `diner-app` since it needs real Next.js SSR, which Pages' static/edge-function model fits less cleanly than Vercel's native support. Worth a second look if the Vercel Hobby ToS tradeoff below becomes decisive. |

## The Vercel Hobby ToS tradeoff (consciously approved, not defaulted)

Vercel's own docs (`vercel.com/docs/plans/hobby`) state that the Hobby plan restricts use to
**non-commercial, personal projects**. digital-menu is a multi-tenant restaurant menu platform - a
commercial product concept even at zero-traffic demo scale, not a toy project. This is a real contractual
tradeoff, not just a cost one, and the captain reviewed it explicitly rather than it being silently
decided by "just use the free tier":

- **Decision:** proceed on Vercel Hobby for both frontends during this low-traffic demo phase.
- **Rationale:** Vercel is not known to actively police this at near-zero-traffic demo scale, and the
  natural trigger to move to Pro ($20/seat/month) - real usage - is the same moment the ToS question would
  force the upgrade anyway.
- **Revisit trigger:** move to Vercel Pro (or the Render-for-diner-app ToS-clean alternative noted in the
  report) when real (non-demo) usage starts. This is not a "fix later" oversight; it is the explicitly
  chosen point at which to revisit.

## Consequences

- Zero code changes were required to make the existing architecture deployable on this stack - both
  frontends already read their API base URL from env with a localhost fallback
  (`apps/admin-portal/src/lib/api-client.ts`, `apps/diner-app/src/lib/api-client.ts`), and
  `apps/api/src/lib/auth.ts`'s session cookie is already written for cross-site deployment
  (`secure`/`sameSite` gated on `NODE_ENV=production`).
- Render's free tier has no Pre-Deploy Command and no shell access, so DB migrations run from a GitHub
  Actions workflow on push to `main` instead (`.github/workflows/migrate.yml`) rather than a host-native
  deploy hook.
- Render's free tier sleeps after 15 minutes idle and Neon autosuspends after 5; a scheduled keep-alive
  ping (`.github/workflows/keep-alive.yml`) against the health check (which now also does a trivial
  `SELECT 1`, see `apps/api/src/routes/health.ts`) keeps both warm at no extra cost, within Render's
  750-free-instance-hour/month budget - achievable specifically because this plan puts only the API on
  Render (both frontends are on Vercel), so there's no other service in the same free-hour pool.
- Render's ephemeral filesystem means any dish/ingredient photo uploaded live during a demo session is
  lost on the next sleep/redeploy cycle (`apps/api/src/lib/uploads.ts`'s local-disk `UPLOAD_DIR`). The
  seeded demo catalog is unaffected (it doesn't reference local upload paths). Accepted as a known
  tradeoff for this phase, not fixed here - see `docs/operations/deployment.md`'s graduation path for the
  object-storage swap (Cloudflare R2) if it becomes a real problem.
- None of the graduation paths (Neon Launch, Render Starter, Vercel Pro) force a platform switch or an
  architecture rewrite - they are plan upgrades on the same services chosen here.

See `docs/operations/deployment.md` for the concrete runbook (accounts, env vars, build/start commands).
