import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@digital-menu/db";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:123456@localhost:5433/digital_menu";

const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });
