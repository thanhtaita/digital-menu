# Deployment, monitoring, rollback

As of 2026-07-25, this documents the approved deployment target and the runbook to stand it up. See
[`docs/decisions/ADR-004-deployment-platform-neon-render-vercel.md`](../decisions/ADR-004-deployment-platform-neon-render-vercel.md)
for why this stack was chosen over the alternatives, including the Vercel Hobby ToS tradeoff.

**Status:** the code-level prerequisites (build fixes, CI workflows, health check, Node pin) are done. The
account creation, GitHub-repo connection, and dashboard env-var configuration below are manual, one-time
steps the captain still needs to do interactively - they are out of scope for an agent working inside a
git worktree (no browser automation available).

## Architecture at a glance

| Piece | Host | Plan | Why |
|---|---|---|---|
| Postgres | [Neon](https://neon.tech) | Free | Always-on free tier, autosuspends after 5 min idle, auto-resumes on next query |
| `apps/api` (Fastify) | [Render](https://render.com) | Free Web Service | Only free host evaluated that runs a genuine long-lived Node process (needed for the persistent `pg.Pool` and the SSE chat stream) |
| `apps/admin-portal` (Vite SPA) | [Vercel](https://vercel.com) | Hobby | Static build, native Turborepo support |
| `apps/diner-app` (Next.js 15 SSR) | [Vercel](https://vercel.com) | Hobby | Vercel is Next.js's own platform |

Total steady-state cost: **$0/month**. See "Graduation path" below for what changes under real load.

## One-time manual setup (captain, outside this repo)

### 1. Neon (Postgres)

1. Create a Neon account and a new project (any region close to Render's chosen region).
2. Copy the **direct** (non-pooled) connection string from the Neon dashboard - not the `-pooler`
   variant. The API is a single long-lived process with one module-level `pg.Pool`
   (`apps/api/src/lib/db.ts`), not a fleet of serverless functions, so the classic
   connection-exhaustion problem the pooler exists for doesn't apply here. Switch to the `-pooler`
   string only if the API is ever horizontally scaled or rewritten as serverless (see "Graduation
   path").
3. Save this connection string - it's needed as `DATABASE_URL` in two places below (Render's env vars,
   and the `DATABASE_URL` GitHub Actions repo secret).

### 2. Render (API)

1. Create a Render account and connect the `digital-menu` GitHub repo.
2. Create a new **Web Service** from that repo:
   - **Root Directory:** repo root (the build command below runs Turborepo from the root).
   - **Build Command:** `pnpm install && pnpm turbo build --filter=@digital-menu/api`
   - **Start Command:** `pnpm --filter @digital-menu/api start` (equivalent to `node apps/api/dist/index.js`)
   - **Instance Type:** Free
3. Set the environment variables below in the Render dashboard (Environment tab):

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | the Neon direct connection string from step 1 |
   | `NODE_ENV` | `production` - **not optional**: without it, `apps/api/src/lib/auth.ts`'s `isProduction` check stays false, session cookies fall back to `sameSite: "lax"` + `secure: false`, and auth silently breaks across the cross-site Vercel↔Render origin pair (login appears to work, then every subsequent request looks logged-out) |
   | `PORT` | leave unset - Render sets this automatically |
   | AI provider keys | whichever of the existing Gemini/OpenAI env vars `apps/api/src/lib/ai/config.ts` reads (inline-default convention, no new vars invented here) |
4. Deploy once manually to confirm it comes up, then leave "Auto-Deploy" on push to `main` enabled
   (Render's default).
5. Note the public URL Render assigns (`https://<service>.onrender.com`) - needed for the frontends'
   env vars below, and for the GitHub repo variable in step 4.

### 3. Vercel (admin-portal and diner-app)

Create **two separate Vercel projects** from the same GitHub repo (Vercel's monorepo support handles
this via per-project Root Directory, not a single project):

**Project 1 - admin-portal:**
- Root Directory: `apps/admin-portal`
- Framework: Vite (auto-detected)
- Env var: `VITE_API_BASE_URL` = `https://<render-api-domain>/api/v1`

**Project 2 - diner-app:**
- Root Directory: `apps/diner-app`
- Framework: Next.js (auto-detected)
- Env var: `NEXT_PUBLIC_API_BASE_URL` = `https://<render-api-domain>/api/v1`

Both deploy on push to `main` by default once the repo is connected, with free preview deploys on PRs.

### 4. GitHub Actions (migrations + keep-alive)

Two workflows already exist in this repo (`.github/workflows/migrate.yml`,
`.github/workflows/keep-alive.yml`) but need repo-level secrets/variables set before they'll work
(Settings → Secrets and variables → Actions, in the GitHub repo):

| Kind | Name | Value |
|---|---|---|
| Secret | `DATABASE_URL` | the same Neon connection string used in Render's env vars |
| Variable | `API_HEALTH_URL` | `https://<render-api-domain>/api/v1/health` |

Once set:
- `migrate.yml` runs `pnpm --filter @digital-menu/db drizzle:migrate` against Neon on every push to
  `main` - this replaces Render's Pre-Deploy Command, which isn't available on the free tier (no
  shell/SSH access either), so this is the only way to apply migrations before the redeployed API
  starts serving the new schema.
- `keep-alive.yml` pings `GET /api/v1/health` every ~12 minutes. `apps/api/src/routes/health.ts` now
  also runs a trivial `SELECT 1` against Postgres, so the same ping keeps both Render's free instance
  (750 free hours/month, sleeps after 15 min idle) and Neon's compute (5-minute autosuspend) warm, at
  no extra cost. This only works because the API is the *only* free service on Render in this plan -
  putting the diner-app there too would blow the shared 750-hour budget.

## Env var summary

| Service | Var | Value | Notes |
|---|---|---|---|
| Render (API) | `DATABASE_URL` | Neon direct connection string | |
| Render (API) | `NODE_ENV` | `production` | Not optional - see step 2 above |
| Render (API) | `PORT` | (unset) | Render sets automatically |
| Render (API) | AI provider keys | per `apps/api/src/lib/ai/config.ts` | Existing inline-default convention |
| Vercel (admin-portal) | `VITE_API_BASE_URL` | `https://<render-api-domain>/api/v1` | |
| Vercel (diner-app) | `NEXT_PUBLIC_API_BASE_URL` | `https://<render-api-domain>/api/v1` | |
| GitHub Actions (repo secret) | `DATABASE_URL` | Neon direct connection string | Used by `migrate.yml` |
| GitHub Actions (repo variable) | `API_HEALTH_URL` | `https://<render-api-domain>/api/v1/health` | Used by `keep-alive.yml` |

## Known limitations of this setup (accepted for the demo phase)

- **Uploads are ephemeral on Render's free tier unless R2 is enabled.** `apps/api/src/lib/uploads.ts`
  defaults to writing dish/ingredient photo/video uploads to local disk (`UPLOAD_DIR`); Render's free
  filesystem is wiped on every sleep/restart/redeploy. The seeded demo catalog is unaffected (seed data
  doesn't reference local upload paths); only photos uploaded live during a session are at risk. See
  "Object storage for uploads" below to switch Render's API service to durable Cloudflare R2 storage
  instead of accepting this tradeoff.
- **Vercel Hobby's non-commercial ToS** applies to both frontends - a consciously-made tradeoff, not an
  oversight. See ADR-004.
- **Cold start after long idle periods can still happen** if the keep-alive workflow is disabled, GitHub
  Actions has an outage, or the repo variables above aren't set - expect a 30-60s delay on the first
  request after 15+ minutes idle.

## Monitoring

Fastify's built-in Pino logger emits structured HTTP logs to stdout in `apps/api`, visible in Render's
dashboard logs. The bespoke `lib/ai-chat-logger.ts` file-logger separately audits LLM calls (writes to
local disk - ephemeral on Render's free tier, same caveat as uploads above). Neither is shipped to an
external aggregator; there is no alerting or dashboard beyond what each platform's own dashboard shows
(Render's service logs/metrics, Vercel's deployment logs, Neon's query/connection metrics).

## Rollback

- **Code:** `git revert`, then push to `main` - all three services redeploy automatically on the next
  push.
- **Database:** migrations here are additive and CI-driven (see `migrate.yml` above); reverting a bad
  migration follows the same recovery procedure as local dev, per the `db-migration` skill
  (`pnpm --filter @digital-menu/db db:reset` then re-migrate/reseed) but run against Neon rather than a
  local Postgres - be deliberate, this touches the real (shared) database, not a disposable local one.
- **Frontends:** Vercel keeps every previous deployment; use its dashboard "Promote to Production" on an
  older deployment for an instant rollback without waiting on a new build.

## Graduation path (what changes if a free tier is hit sooner than expected)

None of these require a platform switch or a rewrite - they are plan upgrades on the same services:

- **Neon** → Launch plan: pay-as-you-go, no monthly minimum, same connection strings. Switch
  `DATABASE_URL` to the `-pooler` connection string if/when the API is horizontally scaled or rewritten
  as serverless (do this *before* scaling out, not after).
- **Render** → Starter ($7/month): removes sleep entirely (keep-alive workflow becomes unnecessary but
  harmless), adds a persistent disk (fixes the ephemeral-upload problem directly, without introducing
  object storage), more RAM/CPU. Same container, same build/start commands.
- **Vercel** → Pro ($20/seat/month): higher limits, team features, and resolves the Hobby ToS question
  in ADR-004 outright. No code changes.
- If Render's free-tier resource ceiling (512 MB RAM / 0.1 CPU, single instance) is too tight even during
  the demo phase before a paid tier is otherwise justified, Railway's Hobby plan ($5/month minimum +
  metered usage) is the natural next stop - better DX, comparable price, no free tier of its own to fall
  back to.
- **Object storage for uploads** (local disk → Cloudflare R2, S3-compatible, free tier: 10 GB storage,
  zero egress fees): implemented as a second `MediaStorage` backend (`apps/api/src/lib/uploads-r2.ts`),
  selected via an env var - not a rearchitecture. Worth enabling before Render Starter if live photo
  uploads during demos are the primary way people use the product; otherwise the Starter disk fixes the
  ephemeral-storage problem as a side effect of a plan upgrade already being made, and R2 can stay off.

  **To enable it (manual steps, captain does these in the Cloudflare dashboard):**
  1. Create a Cloudflare account if one doesn't exist yet, then create an R2 bucket (R2 → Create bucket).
     Any bucket name works; it goes into `R2_BUCKET` below.
  2. Enable public access on the bucket so uploaded media is servable without signed URLs: bucket
     Settings → Public Access → enable the `r2.dev` subdomain (fastest, gives a URL like
     `https://pub-xxxxxxxx.r2.dev`), or connect a custom domain (e.g. `media.yourdomain.com`) via
     Settings → Custom Domains for a branded URL. Either way, note the resulting base URL.
  3. Create an API token scoped to R2: R2 → Manage R2 API Tokens → Create API Token, permission "Object
     Read & Write", scoped to the bucket from step 1. Save the Access Key ID and Secret Access Key shown
     (the secret is only shown once). Note the Account ID shown on the R2 overview page.
  4. On Render, set these env vars on the API service (Render dashboard → service → Environment):

     | Env var | Value |
     |---|---|
     | `STORAGE_DRIVER` | `r2` |
     | `R2_ACCOUNT_ID` | Account ID from step 3 |
     | `R2_ACCESS_KEY_ID` | Access Key ID from step 3 |
     | `R2_SECRET_ACCESS_KEY` | Secret Access Key from step 3 |
     | `R2_BUCKET` | Bucket name from step 1 |
     | `R2_PUBLIC_BASE_URL` | Base URL from step 2 (e.g. `https://pub-xxxxxxxx.r2.dev`, no trailing slash) |

  5. Redeploy the API service so the new env vars take effect.

  With `STORAGE_DRIVER` unset (or any value other than `r2`), the API keeps using local disk with zero
  configuration - local dev is unaffected and needs no R2 credentials. If `STORAGE_DRIVER=r2` is set but
  any `R2_*` var above is missing, uploads fail loudly with a clear error rather than silently falling
  back to ephemeral local storage.

## When this needs to change

If the platform choice itself is revisited (not just a tier upgrade within the same platforms), that's a
new decision with lasting rationale - write a new ADR under `docs/decisions/` rather than editing
ADR-004 or silently rewriting this file's "Architecture at a glance" table.
