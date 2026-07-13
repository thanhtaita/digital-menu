-- Required by the pg_trgm-based similarity() fuzzy matching used by both the ingredient
-- fuzzy search feature and the FDC nutrition backfill (apps/api/src/services/fdc-matching.ts).
-- Not declared in schema.ts because drizzle-kit does not track Postgres extensions in its
-- snapshot diffing (see drizzle/meta/*_snapshot.json - no "extensions" key), so this is a
-- hand-written migration, same precedent as 0006_embeddings.sql's `CREATE EXTENSION IF NOT EXISTS vector`.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
