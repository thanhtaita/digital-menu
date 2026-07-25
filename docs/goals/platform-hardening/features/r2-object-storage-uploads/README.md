# Cloudflare R2 object storage for uploads

## What this is

A second `MediaStorage` backend for dish/ingredient photo and video uploads, alongside the existing
local-disk one, so production deployments can opt into durable storage instead of Render's ephemeral
free-tier filesystem.

## Why it matters

`apps/api/src/lib/uploads.ts` writes uploads to local disk by default; on Render's free tier that
filesystem is wiped on every sleep/restart/redeploy (see
[`docs/operations/deployment.md`](../../../operations/deployment.md), "Known limitations"). R2 gives an
S3-compatible API with a permanent free tier and zero egress fees, so it doesn't force a paid-tier
decision just to fix upload durability.

## How it works

- `MediaStorage` interface (`save`, `deleteByPublicUrl`) already existed in `uploads.ts`; `r2MediaStorage`
  in `apps/api/src/lib/uploads-r2.ts` is a second implementation using `@aws-sdk/client-s3` pointed at
  R2's S3-compatible endpoint (`https://<account-id>.r2.cloudflarestorage.com`).
- `uploads.ts` exports `mediaStorage`, a driver selector: `STORAGE_DRIVER=r2` picks `r2MediaStorage`,
  anything else (including unset, the default) keeps `localMediaStorage` - zero config change for local
  dev.
- The R2 client and its required env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET`, `R2_PUBLIC_BASE_URL`) are only touched lazily on first save/delete call, and only when R2 is
  actually selected - missing vars throw a clear error rather than silently falling back to local disk.
- All upload routes (`dishes.ts`, `ingredients.ts`, `social-posts.ts`, `social-profiles.ts`) now go through
  `mediaStorage` instead of importing `localMediaStorage` directly, so one env var switches every upload
  path at once.

## Status

Implemented. Enabling it in production (creating the R2 bucket/API token, setting Render env vars) is a
manual step for whoever operates the Cloudflare account - see the "Object storage for uploads" runbook in
`docs/operations/deployment.md`.
