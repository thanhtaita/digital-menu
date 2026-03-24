import type { FastifyInstance } from "fastify";
import { eq, asc } from "drizzle-orm";
import { db } from "../lib/db.js";
import { menuSections, menus } from "@digital-menu/db";
import { createSectionSchema, updateSectionSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";

export async function sectionRoutes(app: FastifyInstance) {
  app.get<{ Params: { restaurantId: string; menuId: string } }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const menuId = Number(request.params.menuId);
    if (Number.isNaN(restaurantId) || Number.isNaN(menuId)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const list = await db
      .select()
      .from(menuSections)
      .where(eq(menuSections.menuId, menuId))
      .orderBy(asc(menuSections.displayOrder), asc(menuSections.id));
    return reply.send(list);
  });

  app.post<{ Params: { restaurantId: string; menuId: string }; Body: unknown }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const menuId = Number(request.params.menuId);
    if (Number.isNaN(restaurantId) || Number.isNaN(menuId)) return reply.status(400).send({ error: "Invalid id" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
    if (!menu || menu.restaurantId !== restaurantId) return reply.status(404).send({ error: "Menu not found" });
    const parsed = createSectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const [section] = await db
      .insert(menuSections)
      .values({
        menuId,
        name: parsed.data.name,
        displayOrder: parsed.data.displayOrder ?? 0
      })
      .returning();
    if (!section) return reply.status(500).send({ error: "Failed to create section" });
    return reply.status(201).send(section);
  });

  app.patch<{ Params: { restaurantId: string; menuId: string; sectionId: string }; Body: unknown }>(
    "/:sectionId",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      const restaurantId = Number(request.params.restaurantId);
      const menuId = Number(request.params.menuId);
      const sectionId = Number(request.params.sectionId);
      if (Number.isNaN(restaurantId) || Number.isNaN(menuId) || Number.isNaN(sectionId)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      const [section] = await db.select().from(menuSections).where(eq(menuSections.id, sectionId)).limit(1);
      if (!section || section.menuId !== menuId) return reply.status(404).send({ error: "Section not found" });
      const parsed = updateSectionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const [updated] = await db
        .update(menuSections)
        .set({
          ...(parsed.data.name != null && { name: parsed.data.name }),
          ...(parsed.data.displayOrder !== undefined && { displayOrder: parsed.data.displayOrder })
        })
        .where(eq(menuSections.id, sectionId))
        .returning();
      return reply.send(updated);
    }
  );

  app.delete<{ Params: { restaurantId: string; menuId: string; sectionId: string } }>("/:sectionId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const menuId = Number(request.params.menuId);
    const sectionId = Number(request.params.sectionId);
    if (Number.isNaN(restaurantId) || Number.isNaN(menuId) || Number.isNaN(sectionId)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const [section] = await db.select().from(menuSections).where(eq(menuSections.id, sectionId)).limit(1);
    if (!section || section.menuId !== menuId) return reply.status(404).send({ error: "Section not found" });
    await db.delete(menuSections).where(eq(menuSections.id, sectionId));
    return reply.status(204).send();
  });
}
