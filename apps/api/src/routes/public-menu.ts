import type { FastifyInstance } from "fastify";
import { eq, and, asc, desc, inArray, lt } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  restaurants,
  menus,
  menuSections,
  dishes,
  dishIngredients,
  ingredients,
  dishMedia,
  ingredientMedia,
  posts,
  users
} from "@digital-menu/db";
import { publicMenuResponseSchema, publicRestaurantListResponseSchema } from "@digital-menu/shared";
import { buildPostsResponse, POST_SELECT_COLUMNS, FEED_PAGE_SIZE, type RawPostRow } from "../lib/post-helpers.js";

export async function publicMenuRoutes(app: FastifyInstance) {
  app.get("/restaurants", async () => {
    const rows = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        slug: restaurants.slug,
        description: restaurants.description,
        logoUrl: restaurants.logoUrl
      })
      .from(restaurants)
      .where(eq(restaurants.isActive, true))
      .orderBy(asc(restaurants.name), asc(restaurants.id));

    return publicRestaurantListResponseSchema.parse({ restaurants: rows });
  });

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

    const mediaRows =
      dishIds.length === 0
        ? []
        : await db
            .select()
            .from(dishMedia)
            .where(inArray(dishMedia.dishId, dishIds))
            .orderBy(asc(dishMedia.displayOrder), asc(dishMedia.id));

    const mediaByDish = new Map<number, (typeof mediaRows)[number][]>();
    for (const row of mediaRows) {
      const list = mediaByDish.get(row.dishId) ?? [];
      list.push(row);
      mediaByDish.set(row.dishId, list);
    }
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
                eq(ingredients.approvalStatus, "approved")
              )
            )
            .orderBy(asc(dishIngredients.displayOrder), asc(dishIngredients.id));

    const uniqueIngredientIds = [...new Set(ingredientRows.map((r) => r.ingredientId))];
    const ingredientMediaRows =
      uniqueIngredientIds.length === 0
        ? []
        : await db
            .select()
            .from(ingredientMedia)
            .where(inArray(ingredientMedia.ingredientId, uniqueIngredientIds))
            .orderBy(asc(ingredientMedia.displayOrder), asc(ingredientMedia.id));

    const ingredientMediaById = new Map<number, (typeof ingredientMediaRows)[number][]>();
    for (const row of ingredientMediaRows) {
      const list = ingredientMediaById.get(row.ingredientId) ?? [];
      list.push(row);
      ingredientMediaById.set(row.ingredientId, list);
    }

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
          dishes: (dishesBySection.get(section.id) ?? []).map((dish) => {
            const media = (mediaByDish.get(dish.id) ?? []).map((m) => ({
              id: m.id,
              url: m.url,
              kind: m.kind,
              displayOrder: m.displayOrder
            }));
            const firstImage = media.find((m) => m.kind === "image");
            const derivedImageUrl = firstImage?.url ?? dish.imageUrl;
            return {
            id: dish.id,
            name: dish.name,
            description: dish.description,
            price: String(dish.price),
            imageUrl: derivedImageUrl,
            isAvailable: dish.isAvailable,
            displayOrder: dish.displayOrder,
            media,
            ingredients: (ingredientsByDish.get(dish.id) ?? []).map((ing) => {
              const ingMedia = (ingredientMediaById.get(ing.ingredientId) ?? []).map((m) => ({
                id: m.id,
                url: m.url,
                kind: m.kind,
                displayOrder: m.displayOrder
              }));
              const firstIngImage = ingMedia.find((m) => m.kind === "image");
              const derivedIngImageUrl = firstIngImage?.url ?? ing.imageUrl;
              return {
                id: ing.linkId,
                ingredientId: ing.ingredientId,
                canonicalName: ing.canonicalName,
                slug: ing.slug,
                description: ing.description,
                imageUrl: derivedIngImageUrl,
                media: ingMedia,
                nutrients: ing.nutrients ?? null,
                isCommonAllergen: ing.isCommonAllergen,
                commonAllergenGroup: ing.commonAllergenGroup,
                isOptional: ing.isOptional
              };
            })
          };
          })
        }))
      }))
    };

    const parsed = publicMenuResponseSchema.parse(payload);
    return reply.send(parsed);
  });

  // GET /public/restaurants/:slug/posts — no auth, cursor-based
  app.get<{ Params: { slug: string } }>("/restaurants/:slug/posts", async (request, reply) => {
    const [restaurant] = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(and(eq(restaurants.slug, request.params.slug), eq(restaurants.isActive, true)))
      .limit(1);

    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    const query = request.query as { before?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || FEED_PAGE_SIZE, 50);
    const before = query.before ? parseInt(query.before, 10) : null;

    const rows = await db
      .select(POST_SELECT_COLUMNS)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .leftJoin(restaurants, eq(posts.restaurantId, restaurants.id))
      .where(
        before !== null && !isNaN(before)
          ? and(eq(posts.restaurantId, restaurant.id), lt(posts.id, before))
          : eq(posts.restaurantId, restaurant.id)
      )
      .orderBy(desc(posts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const postsList = await buildPostsResponse(page as RawPostRow[], null);
    return reply.send({ posts: postsList, nextCursor });
  });
}
