/**
 * Drops and recreates the public schema so drizzle:migrate can run cleanly.
 * Use when the DB is in a partial state (e.g. after a failed migration).
 */
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:123456@localhost:5433/digital_menu";

async function reset() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO postgres");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    console.log("Schema reset done. Run drizzle:migrate next.");
  } finally {
    await client.end();
  }
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
