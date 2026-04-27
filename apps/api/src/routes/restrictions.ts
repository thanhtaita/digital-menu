import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { userRestrictions, ingredients } from "@digital-menu/db";
import { createRestrictionSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";

export async function restrictionRoutes(app: FastifyInstance) {
  app.get("/users/me/restrictions", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const rows = await db
      .select({
        id: userRestrictions.id,
        userId: userRestrictions.userId,
        restrictionType: userRestrictions.restrictionType,
        ingredientId: userRestrictions.ingredientId,
        dietType: userRestrictions.dietType,
        severity: userRestrictions.severity,
        ingredient: {
          id: ingredients.id,
          canonicalName: ingredients.canonicalName,
          slug: ingredients.slug
        }
      })
      .from(userRestrictions)
      .leftJoin(ingredients, eq(userRestrictions.ingredientId, ingredients.id))
      .where(eq(userRestrictions.userId, auth.user.userId));

    return reply.send({
      restrictions: rows.map((r) => ({
        ...r,
        ingredient: r.ingredient?.id ? r.ingredient : null
      }))
    });
  });

  app.post("/users/me/restrictions", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const parsed = createRestrictionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { restrictionType, ingredientId, dietType, severity } = parsed.data;

    if (ingredientId) {
      const [ing] = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1);
      if (!ing) return reply.status(404).send({ error: "Ingredient not found" });
    }

    const [inserted] = await db
      .insert(userRestrictions)
      .values({
        userId: auth.user.userId,
        restrictionType,
        ingredientId: ingredientId ?? null,
        dietType: dietType ?? null,
        severity
      })
      .returning();

    return reply.status(201).send({ restriction: inserted });
  });

  app.delete("/users/me/restrictions/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid id" });

    const [row] = await db
      .select({ id: userRestrictions.id })
      .from(userRestrictions)
      .where(and(eq(userRestrictions.id, id), eq(userRestrictions.userId, auth.user.userId)))
      .limit(1);

    if (!row) return reply.status(404).send({ error: "Restriction not found" });

    await db.delete(userRestrictions).where(eq(userRestrictions.id, id));
    return reply.status(204).send();
  });
}
