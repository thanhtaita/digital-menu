import type { FastifyInstance } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../lib/db.js";
import { dishes, menuSections, menus } from "@digital-menu/db";
import { createDishSchema, updateDishSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";

function parsePrice(value: string | number): string {
  if (typeof value === "number") return String(value);
  return value;
}

export async function dishRoutes(app: FastifyInstance) {
  app.get<{ Params: { restaurantId: string; menuId: string; sectionId: string } }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const sectionId = Number(request.params.sectionId);
    if (Number.isNaN(restaurantId) || Number.isNaN(sectionId)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [section] = await db.select().from(menuSections).where(eq(menuSections.id, sectionId)).limit(1);
    if (!section) return reply.status(404).send({ error: "Section not found" });
    const [menu] = await db.select().from(menus).where(eq(menus.id, section.menuId)).limit(1);
    if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Section not found" });
    const list = await db
      .select()
      .from(dishes)
      .where(eq(dishes.sectionId, sectionId))
      .orderBy(asc(dishes.displayOrder), asc(dishes.id));
    return reply.send(list);
  });

  app.post<{ Params: { restaurantId: string; menuId: string; sectionId: string }; Body: unknown }>(
    "/",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      const restaurantId = Number(request.params.restaurantId);
      const sectionId = Number(request.params.sectionId);
      if (Number.isNaN(restaurantId) || Number.isNaN(sectionId)) return reply.status(400).send({ error: "Invalid id" });
      const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      const [section] = await db.select().from(menuSections).where(eq(menuSections.id, sectionId)).limit(1);
      if (!section) return reply.status(404).send({ error: "Section not found" });
      const [menu] = await db.select().from(menus).where(eq(menus.id, section.menuId)).limit(1);
      if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Section not found" });
      const parsed = createDishSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const price = parsePrice(parsed.data.price);
      const [dish] = await db
        .insert(dishes)
        .values({
          sectionId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          price,
          imageUrl: parsed.data.imageUrl || null,
          isAvailable: parsed.data.isAvailable ?? true,
          displayOrder: parsed.data.displayOrder ?? 0
        })
        .returning();
      if (!dish) return reply.status(500).send({ error: "Failed to create dish" });
      return reply.status(201).send(dish);
    }
  );

  app.get<{ Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string } }>(
    "/:dishId",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      const restaurantId = Number(request.params.restaurantId);
      const sectionId = Number(request.params.sectionId);
      const dishId = Number(request.params.dishId);
      if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      const [dish] = await db.select().from(dishes).where(eq(dishes.id, dishId)).limit(1);
      if (!dish || dish.sectionId !== sectionId) return reply.status(404).send({ error: "Dish not found" });
      const [section] = await db.select().from(menuSections).where(eq(menuSections.id, sectionId)).limit(1);
      const [menu] = section
        ? await db.select().from(menus).where(eq(menus.id, section.menuId)).limit(1)
        : [null];
      if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Dish not found" });
      return reply.send(dish);
    }
  );

  app.patch<{ Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string }; Body: unknown }>(
    "/:dishId",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      const restaurantId = Number(request.params.restaurantId);
      const sectionId = Number(request.params.sectionId);
      const dishId = Number(request.params.dishId);
      if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      const [dish] = await db.select().from(dishes).where(eq(dishes.id, dishId)).limit(1);
      if (!dish || dish.sectionId !== sectionId) return reply.status(404).send({ error: "Dish not found" });
      const parsed = updateDishSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const [updated] = await db
        .update(dishes)
        .set({
          ...(parsed.data.name != null && { name: parsed.data.name }),
          ...(parsed.data.description !== undefined && { description: parsed.data.description ?? null }),
          ...(parsed.data.price !== undefined && { price: parsePrice(parsed.data.price) }),
          ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl || null }),
          ...(parsed.data.isAvailable !== undefined && { isAvailable: parsed.data.isAvailable }),
          ...(parsed.data.displayOrder !== undefined && { displayOrder: parsed.data.displayOrder })
        })
        .where(eq(dishes.id, dishId))
        .returning();
      return reply.send(updated);
    }
  );

  app.delete<{ Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string } }>(
    "/:dishId",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      const restaurantId = Number(request.params.restaurantId);
      const sectionId = Number(request.params.sectionId);
      const dishId = Number(request.params.dishId);
      if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      const [dish] = await db.select().from(dishes).where(eq(dishes.id, dishId)).limit(1);
      if (!dish || dish.sectionId !== sectionId) return reply.status(404).send({ error: "Dish not found" });
      await db.delete(dishes).where(eq(dishes.id, dishId));
      return reply.status(204).send();
    }
  );
}
