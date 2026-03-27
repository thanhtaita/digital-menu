import type { FastifyInstance } from "fastify";
import { eq, and, asc, inArray, or } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  restaurants,
  menus,
  menuSections,
  dishes,
  dishIngredients,
  ingredients
} from "@digital-menu/db";
import { publicMenuResponseSchema } from "@digital-menu/shared";

export async function publicMenuRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>("/restaurants/:slug/menu", async (request, reply) => {
    const slug = request.params.slug;
    const [restaurant] = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        description: restaurants.description,
        logoUrl: restaurants.logoUrl
      })
      .from(restaurants)
      .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!restaurant) {
      return reply.status(404).send({ error: "Restaurant not found" });
    }

    const menuRows = await db
      .select()
      .from(menus)
      .where(and(eq(menus.restaurantId, restaurant.id), eq(menus.isPublished, true)))
      .orderBy(asc(menus.displayOrder), asc(menus.id));

    if (menuRows.length === 0) {
      const empty = publicMenuResponseSchema.parse({
        restaurant,
        menus: []
      });
      return reply.send(empty);
    }

    const menuIds = menuRows.map((m) => m.id);
    const sectionRows = await db
      .select()
      .from(menuSections)
      .where(inArray(menuSections.menuId, menuIds))
      .orderBy(asc(menuSections.displayOrder), asc(menuSections.id));

    if (sectionRows.length === 0) {
      const parsed = publicMenuResponseSchema.parse({
        restaurant,
        menus: menuRows.map((m) => ({
          id: m.id,
          name: m.name,
          displayOrder: m.displayOrder,
          sections: []
        }))
      });
      return reply.send(parsed);
    }

    const sectionIds = sectionRows.map((s) => s.id);
    const dishRows = await db
      .select()
      .from(dishes)
      .where(inArray(dishes.sectionId, sectionIds))
      .orderBy(asc(dishes.displayOrder), asc(dishes.id));

    const dishIds = dishRows.map((d) => d.id);
    const ingredientVisibility = or(
      eq(ingredients.approvalStatus, "approved"),
      and(eq(ingredients.approvalStatus, "pending"), eq(ingredients.requestedByRestaurantId, restaurant.id))
    );

    const ingredientRows =
      dishIds.length === 0
        ? []
        : await db
            .select({
              linkId: dishIngredients.id,
              dishId: dishIngredients.dishId,
              ingredientId: dishIngredients.ingredientId,
              isOptional: dishIngredients.isOptional,
              canonicalName: ingredients.canonicalName,
              slug: ingredients.slug,
              description: ingredients.description,
              imageUrl: ingredients.imageUrl,
              nutrients: ingredients.nutrients,
              isCommonAllergen: ingredients.isCommonAllergen,
              commonAllergenGroup: ingredients.commonAllergenGroup
            })
            .from(dishIngredients)
            .innerJoin(ingredients, eq(dishIngredients.ingredientId, ingredients.id))
            .where(
              and(
                inArray(dishIngredients.dishId, dishIds),
                eq(dishIngredients.isHidden, false),
                ingredientVisibility
              )
            )
            .orderBy(asc(dishIngredients.displayOrder), asc(dishIngredients.id));

    const ingredientsByDish = new Map<number, typeof ingredientRows>();
    for (const row of ingredientRows) {
      const list = ingredientsByDish.get(row.dishId) ?? [];
      list.push(row);
      ingredientsByDish.set(row.dishId, list);
    }

    const dishesBySection = new Map<number, typeof dishRows>();
    for (const dish of dishRows) {
      const list = dishesBySection.get(dish.sectionId) ?? [];
      list.push(dish);
      dishesBySection.set(dish.sectionId, list);
    }

    const sectionsByMenu = new Map<number, typeof sectionRows>();
    for (const section of sectionRows) {
      const list = sectionsByMenu.get(section.menuId) ?? [];
      list.push(section);
      sectionsByMenu.set(section.menuId, list);
    }

    const payload = {
      restaurant,
      menus: menuRows.map((menu) => ({
        id: menu.id,
        name: menu.name,
        displayOrder: menu.displayOrder,
        sections: (sectionsByMenu.get(menu.id) ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          displayOrder: section.displayOrder,
          dishes: (dishesBySection.get(section.id) ?? []).map((dish) => ({
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: String(dish.price),
            imageUrl: dish.imageUrl,
            isAvailable: dish.isAvailable,
            displayOrder: dish.displayOrder,
            ingredients: (ingredientsByDish.get(dish.id) ?? []).map((ing) => ({
              id: ing.linkId,
              ingredientId: ing.ingredientId,
              canonicalName: ing.canonicalName,
              slug: ing.slug,
              description: ing.description,
              imageUrl: ing.imageUrl,
              nutrients: ing.nutrients ?? null,
              isCommonAllergen: ing.isCommonAllergen,
              commonAllergenGroup: ing.commonAllergenGroup,
              isOptional: ing.isOptional
            }))
          }))
        }))
      }))
    };

    const parsed = publicMenuResponseSchema.parse(payload);
    return reply.send(parsed);
  });
}
