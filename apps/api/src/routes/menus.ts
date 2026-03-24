import type { FastifyInstance } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../lib/db.js";
import { menus } from "@digital-menu/db";
import { createMenuSchema, updateMenuSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";

export async function menuRoutes(app: FastifyInstance) {
  app.get<{ Params: { restaurantId: string } }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    if (Number.isNaN(restaurantId)) return reply.status(400).send({ error: "Invalid restaurantId" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const list = await db
      .select()
      .from(menus)
      .where(eq(menus.restaurantId, restaurantId))
      .orderBy(asc(menus.displayOrder), asc(menus.id));
    return reply.send(list);
  });

  app.post<{ Params: { restaurantId: string }; Body: unknown }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    if (Number.isNaN(restaurantId)) return reply.status(400).send({ error: "Invalid restaurantId" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const parsed = createMenuSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [menu] = await db
      .insert(menus)
      .values({
        restaurantId,
        name: parsed.data.name,
        displayOrder: parsed.data.displayOrder ?? 0
      })
      .returning();
    if (!menu) return reply.status(500).send({ error: "Failed to create menu" });
    return reply.status(201).send(menu);
  });

  app.get<{ Params: { restaurantId: string; menuId: string } }>("/:menuId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const menuId = Number(request.params.menuId);
    if (Number.isNaN(restaurantId) || Number.isNaN(menuId)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [menu] = await db
      .select()
      .from(menus)
      .where(eq(menus.id, menuId))
      .limit(1);
    if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Menu not found" });
    return reply.send(menu);
  });

  app.patch<{ Params: { restaurantId: string; menuId: string }; Body: unknown }>("/:menuId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const menuId = Number(request.params.menuId);
    if (Number.isNaN(restaurantId) || Number.isNaN(menuId)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
    if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Menu not found" });
    const parsed = updateMenuSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [updated] = await db
      .update(menus)
      .set({
        ...(parsed.data.name != null && { name: parsed.data.name }),
        ...(parsed.data.isPublished !== undefined && { isPublished: parsed.data.isPublished }),
        ...(parsed.data.displayOrder !== undefined && { displayOrder: parsed.data.displayOrder })
      })
      .where(eq(menus.id, menuId))
      .returning();
    return reply.send(updated);
  });

  app.delete<{ Params: { restaurantId: string; menuId: string } }>("/:menuId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const menuId = Number(request.params.menuId);
    if (Number.isNaN(restaurantId) || Number.isNaN(menuId)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
    if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Menu not found" });
    await db.delete(menus).where(eq(menus.id, menuId));
    return reply.status(204).send();
  });
}
