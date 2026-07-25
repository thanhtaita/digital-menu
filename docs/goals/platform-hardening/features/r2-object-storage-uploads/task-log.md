## 2026-07-25 17:40 — Add Cloudflare R2 storage backend for uploads

Adds `r2MediaStorage` (`apps/api/src/lib/uploads-r2.ts`) as a second `MediaStorage` implementation using
`@aws-sdk/client-s3` against R2's S3-compatible endpoint, and a `mediaStorage` driver selector in
`uploads.ts` gated on `STORAGE_DRIVER=r2`. Replaced every direct `localMediaStorage` import/usage in
`dishes.ts`, `ingredients.ts`, `social-posts.ts`, `social-profiles.ts` with the selector. R2 client
construction and required env var checks (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `R2_PUBLIC_BASE_URL`) are lazy, so local dev with `STORAGE_DRIVER` unset needs no R2
credentials and behaves exactly as before. Added unit tests mocking `@aws-sdk/client-s3`
(`__tests__/uploads-r2.test.ts`) covering save/delete/validation, and a driver-selection test
(`__tests__/uploads-driver.test.ts`). Updated `docs/operations/deployment.md`'s "Object storage for
uploads" section from a forward-looking note into a concrete enable runbook.
