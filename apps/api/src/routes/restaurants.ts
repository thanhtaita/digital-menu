import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import { restaurants, restaurantAdmins } from "@digital-menu/db";
import { createRestaurantSchema, updateRestaurantSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";

export async function restaurantRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const { userId } = auth.user;
    const owned = await db.select().from(restaurants).where(eq(restaurants.ownerId, userId));
    const adminLinks = await db
      .select({ restaurantId: restaurantAdmins.restaurantId })
      .from(restaurantAdmins)
      .where(eq(restaurantAdmins.userId, userId));
    const adminIds = adminLinks.map((r) => r.restaurantId).filter((id) => !owned.some((o) => o.id === id));
    const allIds = [...owned.map((r) => r.id), ...adminIds];
    if (allIds.length === 0) return reply.send([]);
    const list = await db.select().from(restaurants).where(inArray(restaurants.id, allIds));
    return reply.send(list);
  });

  app.post<{ Body: unknown }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const parsed = createRestaurantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [existing] = await db.select().from(restaurants).where(eq(restaurants.slug, parsed.data.slug)).limit(1);
    if (existing) {
      return reply.status(409).send({ error: "Slug already taken", code: "SLUG_TAKEN" });
    }
    const [restaurant] = await db
      .insert(restaurants)
      .values({
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        ownerId: auth.user.userId
      })
      .returning();
    if (!restaurant) return reply.status(500).send({ error: "Failed to create restaurant" });
    await db.insert(restaurantAdmins).values({ userId: auth.user.userId, restaurantId: restaurant.id });
    return reply.status(201).send(restaurant);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const id = Number(request.params.id);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, id);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
    return reply.send(restaurant);
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const id = Number(request.params.id);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, id);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const parsed = updateRestaurantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [restaurant] = await db
      .update(restaurants)
      .set({
        ...(parsed.data.name != null && { name: parsed.data.name }),
        ...(parsed.data.slug != null && { slug: parsed.data.slug }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description ?? null })
      })
      .where(eq(restaurants.id, id))
      .returning();
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });
    return reply.send(restaurant);
  });
}
