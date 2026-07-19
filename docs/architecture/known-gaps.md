# Known gaps / gotchas

Standing rough edges that are real (not hypothetical) but don't rise to their own ADR. If one of these
turns out to need a deliberate tradeoff decision later, promote it to `docs/decisions/ADR-NNN-*.md` and
link back from here instead of duplicating.

- **DB migration discipline is strict** because tracking has desynced before - two columns were once added to the dev DB out-of-band (no tracked migration), and `packages/db/drizzle/meta/` was separately missing several snapshot files, which together made `drizzle-kit generate` produce a dangerously wrong diff (recreating 16 already-existing tables) until it was fixed and verified directly against the live DB. Fixed now (migration `0009`, tracking reconciled, `generate` reports clean). See the `db-migration` skill for the full story and procedure; never hand-edit `packages/db/drizzle/*.sql` or `meta/_journal.json` outside a verified recovery like that one.
- `ingredient_aliases` seed data currently tags some non-English aliases (French/Italian) with `languageCode: "en"` - a known rough edge in `packages/seed/src/seed-test-data.ts`, not a schema limitation.
- Diet-type restrictions are applied to dish-level filtering via `ingredients.diet_tags` (see the `seed-and-ingredient-data` skill and [`docs/goals/dietary-safety-and-nutrition/features/diet-type-restrictions/`](../goals/dietary-safety-and-nutrition/features/diet-type-restrictions/README.md)), but that jsonb map is only populated where the `backfill:diet-tags` script has run and/or a superadmin has cleared its review queue - ingredients that predate the backfill, or were only ever seeded (not backfilled), show `diet_tags: null` and contribute no diet signal (correctly "safe", not incorrectly "blocked", but also not actually vetted).
- Rate limiting covers only the LLM-backed routes and ingredient search (see [`docs/goals/platform-hardening/features/llm-and-search-rate-limiting/`](../goals/platform-hardening/features/llm-and-search-rate-limiting/README.md)); every other route (auth, restaurant/menu/dish CRUD, social layer, uploads, etc.) is still unthrottled.
- `pg_trgm` extension usage for ingredient fuzzy search should be reconfirmed if search behavior seems off (skipped silently if the extension is unavailable).
- No Docker Compose or other deployment config exists yet; local dev only. See [`docs/operations/deployment.md`](../operations/deployment.md).
- `public.ingredients.fdcId`/`nutrients` are backfilled by `pnpm --filter @digital-menu/api backfill:fdc` (see [`docs/architecture/fdc-reference-data.md`](./fdc-reference-data.md) and the `seed-and-ingredient-data` skill) - but this only does anything if the `fdc` schema has actually been loaded into your local DB first (`resources/.../import/load.py`); most ingredients will still have `fdc_id: null` until both steps have been run.

## See also

- [`docs/decisions/ADR-002-local-dev-api-port-default.md`](../decisions/ADR-002-local-dev-api-port-default.md) - the port 3001-vs-3002 mismatch, promoted to an ADR since it involved a deliberate standardization decision rather than just a rough edge.
