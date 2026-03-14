import type { FastifyInstance } from "fastify";
import { ilike } from "drizzle-orm";
import { db } from "../lib/db.js";
import { ingredients } from "@digital-menu/db";

export async function ingredientRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { q?: string };
  }>("/", async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q) {
      const list = await db.select().from(ingredients).limit(50);
      return reply.send(list);
    }
    const list = await db
      .select()
      .from(ingredients)
      .where(ilike(ingredients.canonicalName, `%${q}%`))
      .limit(30);
    return reply.send(list);
  });
}
