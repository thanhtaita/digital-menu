import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../lib/db.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
    } catch (err) {
      app.log.error(err, "health check: database ping failed");
      return reply.code(503).send({ status: "error", service: "digital-menu-api" });
    }
    return { status: "ok", service: "digital-menu-api" };
  });
}
