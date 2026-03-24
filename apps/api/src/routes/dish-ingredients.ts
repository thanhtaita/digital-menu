import type { FastifyInstance } from "fastify";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../lib/db.js";
import { dishIngredients, dishes, menuSections, menus, ingredients } from "@digital-menu/db";
import { addDishIngredientSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";

async function getRestaurantIdByDishId(dishId: number): Promise<number | null> {
  const [dish] = await db.select({ sectionId: dishes.sectionId }).from(dishes).where(eq(dishes.id, dishId)).limit(1);
  if (!dish) return null;
  const [section] = await db.select({ menuId: menuSections.menuId }).from(menuSections).where(eq(menuSections.id, dish.sectionId)).limit(1);
  if (!section) return null;
  const [menu] = await db.select({ restaurantId: menus.restaurantId }).from(menus).where(eq(menus.id, section.menuId)).limit(1);
  return menu?.restaurantId ?? null;
}

export async function dishIngredientRoutes(app: FastifyInstance) {
  app.get<{ Params: { dishId: string } }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const dishId = Number(request.params.dishId);
    if (Number.isNaN(dishId)) return reply.status(400).send({ error: "Invalid dishId" });
    const restaurantId = await getRestaurantIdByDishId(dishId);
    if (restaurantId == null) return reply.status(404).send({ error: "Dish not found" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const list = await db
      .select({
        id: dishIngredients.id,
        dishId: dishIngredients.dishId,
        ingredientId: dishIngredients.ingredientId,
        isOptional: dishIngredients.isOptional,
        isHidden: dishIngredients.isHidden,
        displayOrder: dishIngredients.displayOrder,
        canonicalName: ingredients.canonicalName,
        slug: ingredients.slug
      })
      .from(dishIngredients)
      .innerJoin(ingredients, eq(dishIngredients.ingredientId, ingredients.id))
      .where(eq(dishIngredients.dishId, dishId))
      .orderBy(asc(dishIngredients.displayOrder), asc(dishIngredients.id));
    return reply.send(list);
  });

  app.post<{ Params: { dishId: string }; Body: unknown }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const dishId = Number(request.params.dishId);
    if (Number.isNaN(dishId)) return reply.status(400).send({ error: "Invalid dishId" });
    const restaurantId = await getRestaurantIdByDishId(dishId);
    if (restaurantId == null) return reply.status(404).send({ error: "Dish not found" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    const parsed = addDishIngredientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const existingLinks = await db
      .select({ displayOrder: dishIngredients.displayOrder })
      .from(dishIngredients)
      .where(eq(dishIngredients.dishId, dishId));
    const maxOrder = existingLinks.length > 0 ? Math.max(...existingLinks.map((r) => r.displayOrder)) + 1 : 0;
    const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, parsed.data.ingredientId)).limit(1);
    if (!ingredient) return reply.status(404).send({ error: "Ingredient not found" });
    const [link] = await db
      .insert(dishIngredients)
      .values({
        dishId,
        ingredientId: parsed.data.ingredientId,
        isOptional: parsed.data.isOptional ?? false,
        isHidden: parsed.data.isHidden ?? false,
        displayOrder: parsed.data.displayOrder ?? maxOrder
      })
      .onConflictDoNothing({ target: [dishIngredients.dishId, dishIngredients.ingredientId] })
      .returning();
    if (!link) return reply.status(409).send({ error: "Ingredient already added to dish", code: "ALREADY_ADDED" });
    const row = await db
      .select({
        id: dishIngredients.id,
        dishId: dishIngredients.dishId,
        ingredientId: dishIngredients.ingredientId,
        isOptional: dishIngredients.isOptional,
        isHidden: dishIngredients.isHidden,
        displayOrder: dishIngredients.displayOrder,
        canonicalName: ingredients.canonicalName,
        slug: ingredients.slug
      })
      .from(dishIngredients)
      .innerJoin(ingredients, eq(dishIngredients.ingredientId, ingredients.id))
      .where(eq(dishIngredients.id, link.id))
      .limit(1);
    return reply.status(201).send(row[0]);
  });

  app.delete<{ Params: { dishId: string; ingredientId: string } }>("/:ingredientId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const dishId = Number(request.params.dishId);
    const ingredientId = Number(request.params.ingredientId);
    if (Number.isNaN(dishId) || Number.isNaN(ingredientId)) return reply.status(400).send({ error: "Invalid id" });
    const restaurantId = await getRestaurantIdByDishId(dishId);
    if (restaurantId == null) return reply.status(404).send({ error: "Dish not found" });
    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    await db
      .delete(dishIngredients)
      .where(and(eq(dishIngredients.dishId, dishId), eq(dishIngredients.ingredientId, ingredientId)));
    return reply.status(204).send();
  });
}
