---
name: db-migration
description: Drizzle schema and migration workflow for packages/db - use whenever adding, changing, or removing a table/column/index in schema.ts, or when DB migration tracking looks broken.
---

# DB migration workflow

`packages/db` uses Drizzle ORM + drizzle-kit. **Drizzle owns migrations.** `packages/db/src/schema/schema.ts` is the single source of truth; everything under `packages/db/drizzle/` is generated from it.

## Never do this

- Never hand-write `packages/db/drizzle/*.sql` migration files.
- Never manually edit `packages/db/drizzle/meta/_journal.json` or `meta/*_snapshot.json`.
- Never run raw `CREATE TABLE`/`ALTER TABLE` SQL in a DB client for a change that a Drizzle migration should cover.

Hand-written or partially-generated migrations desync `drizzle.__drizzle_migrations` tracking. A broken migration can fail silently and block every migration after it.

## Required workflow for any schema change

1. Edit `packages/db/src/schema/schema.ts` only.
2. Generate the migration:
   ```bash
   pnpm --filter @digital-menu/db drizzle:generate
   ```
3. Commit the **generated** artifacts together, as a set:
   - `packages/db/drizzle/NNNN_*.sql`
   - `packages/db/drizzle/meta/_journal.json`
   - the new/updated `packages/db/drizzle/meta/*_snapshot.json`
4. Apply it:
   ```bash
   pnpm --filter @digital-menu/db drizzle:migrate
   ```
   Uses the same `DATABASE_URL` as `apps/api` (`packages/db/drizzle.config.ts` default: `postgres://postgres:123456@localhost:5433/digital_menu`).
5. Verify - don't trust "migrations applied successfully" alone:
   - The new table/column actually exists (`psql`, `drizzle-kit studio`, or a quick `SELECT`).
   - A new SHA-256 hash row appears in `drizzle.__drizzle_migrations`.

Schema work is **not done** until step 5 passes.

## If tracking is already broken (local dev)

```bash
pnpm --filter @digital-menu/db db:reset
pnpm --filter @digital-menu/seed seed         # optional, re-seed ingredients
pnpm --filter @digital-menu/seed seed:menus   # optional, re-seed menus (after ingredients)
```

`db:reset` drops and recreates the `public` schema, then re-runs all migrations from scratch. See `SETUP.md` § Reset for the full recovery flow.

## Worked cautionary example: the 0009 incident

Two separate problems compounded:

1. `aiChatSessions.likedDishNames` and `aiChatMessages.recommendations` (jsonb columns) had been added directly to the dev database **out-of-band** - not through a tracked migration. `schema.ts` had them, the live DB had them, but no `.sql` file or `meta/_journal.json` entry recorded how they got there. A stray, orphaned `packages/db/drizzle/meta/0009_snapshot.json` existed with no matching SQL file or journal entry (likely a leftover from someone's abandoned `generate` attempt).
2. Separately, `meta/` was missing the snapshot files for migrations `0001`, `0002`, and `0004`-`0008` (only `0000` and `0003` existed). Since `drizzle-kit generate` diffs against the *last snapshot it can find*, it was silently diffing against the `0003` state - meaning it would try to recreate **16 already-existing tables** (everything added by migrations 0004-0008) as brand-new, which would have failed loudly (or worse) if blindly migrated.

There was also a third, unrelated bug blocking `generate` from running at all: `schema.ts`'s `dishEmbeddings` vector index was declared as plain `index(...).on(table.embedding)`, missing the `hnsw`/`vector_cosine_ops` annotation that the already-applied `0006_embeddings.sql` actually used. `drizzle-kit` refused to generate anything until that annotation was added back to `schema.ts` to match reality.

**Fix, in order:**

1. Fixed the `dishEmbeddings` index declaration in `schema.ts` to `index("dish_embeddings_vector_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))` so `generate` would run at all.
2. Deleted the orphaned `meta/0009_snapshot.json`, then ran `drizzle:generate` clean - it produced a *complete, accurate* new snapshot of the full current schema (fixing the broken chain going forward) but an SQL file that wrongly recreated 16 existing tables (a side effect of the missing 0004-0008 snapshots).
3. **Verified the real gap directly against the live DB** (via a one-off script querying `information_schema.columns`) rather than trusting the generated diff - confirming every table/column/index in the bad diff already existed except the two jsonb columns, which were also already present.
4. Replaced the generated `.sql` file's contents with a minimal, hand-written, idempotent migration (`ADD COLUMN IF NOT EXISTS`) for just the two columns - a deliberate, narrow exception to "never hand-write migration SQL," justified because the generated diff was independently verified wrong and a plain re-run would have re-broken things. Kept the newly generated snapshot + journal entry (they're correct - they describe the *current full schema*, not the bad diff).
5. Ran `drizzle:migrate` - succeeded as a no-op against the already-correct dev DB, and added the missing tracking row. `drizzle.__drizzle_migrations` went from 9 rows to 10. A follow-up `drizzle:generate` reported "No schema changes, nothing to migrate" - confirming the chain is fully reconciled.

**Lesson**: if `generate` produces a suspiciously large diff (recreating tables you know already exist), don't trust it blindly - the snapshot chain itself may be broken. Verify the live DB directly before writing or applying anything.
