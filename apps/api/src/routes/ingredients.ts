import type { FastifyInstance } from "fastify";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { createIngredientSchema, requestIngredientSchema } from "@digital-menu/shared";
import { db } from "../lib/db.js";
import { dishIngredients, ingredients, restaurants } from "@digital-menu/db";
import { requireAuth } from "../middleware/auth.js";
import {
  canUserManageRestaurant,
  getRestaurantIdsManagedByUser
} from "../lib/restaurant-access.js";
import { getSession, getSessionIdFromCookie } from "../lib/auth.js";

function slugifyCanonicalName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "ingredient";
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 0;
  for (;;) {
    const [row] = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.slug, candidate)).limit(1);
    if (!row) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function visibilityWhere(restaurantIds: number[]): SQL {
  const approved = eq(ingredients.approvalStatus, "approved");
  if (restaurantIds.length === 0) return approved;
  return or(
    approved,
    and(eq(ingredients.approvalStatus, "pending"), inArray(ingredients.requestedByRestaurantId, restaurantIds))
  )!;
}

export async function ingredientRoutes(app: FastifyInstance) {
  app.get("/pending", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role !== "superadmin") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const list = await db
      .select({
        id: ingredients.id,
        canonicalName: ingredients.canonicalName,
        slug: ingredients.slug,
        description: ingredients.description,
        approvalStatus: ingredients.approvalStatus,
        requestedByRestaurantId: ingredients.requestedByRestaurantId,
        restaurantName: restaurants.name
      })
      .from(ingredients)
      .leftJoin(restaurants, eq(ingredients.requestedByRestaurantId, restaurants.id))
      .where(eq(ingredients.approvalStatus, "pending"))
      .orderBy(asc(ingredients.id));
    return reply.send(list);
  });

  app.get<{
    Querystring: { q?: string };
  }>("/", async (request, reply) => {
    const q = request.query.q?.trim();
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const sessionUser = await getSession(sessionId);
    const restaurantIds = sessionUser ? await getRestaurantIdsManagedByUser(sessionUser.userId) : [];
    const vis = visibilityWhere(restaurantIds);

    if (!q) {
      const list = await db.select().from(ingredients).where(vis).limit(50);
      return reply.send(list);
    }
    const list = await db
      .select()
      .from(ingredients)
      .where(and(vis, ilike(ingredients.canonicalName, `%${q}%`)))
      .limit(30);
    return reply.send(list);
  });

  app.post<{ Body: unknown }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role === "diner") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }

    if (auth.user.role === "superadmin") {
      const parsed = createIngredientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { canonicalName, slug: slugInput, description, imageUrl, isCommonAllergen, commonAllergenGroup } =
        parsed.data;
      const [nameDup] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.canonicalName, canonicalName))
        .limit(1);
      if (nameDup) {
        return reply.status(409).send({ error: "Ingredient name already exists", code: "CANONICAL_NAME_TAKEN" });
      }
      const baseSlug = slugInput ?? slugifyCanonicalName(canonicalName);
      const slug = await ensureUniqueSlug(baseSlug);
      const [created] = await db
        .insert(ingredients)
        .values({
          canonicalName,
          slug,
          description: description ?? null,
          imageUrl: imageUrl && imageUrl !== "" ? imageUrl : null,
          isCommonAllergen: isCommonAllergen ?? false,
          commonAllergenGroup: commonAllergenGroup ?? null,
          approvalStatus: "approved",
          requestedByRestaurantId: null
        })
        .returning();
      return reply.status(201).send(created);
    }

    const parsed = requestIngredientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { canonicalName, slug: slugInput, description, restaurantId } = parsed.data;
    const allowed = await canUserManageRestaurant(auth.user.userId, restaurantId);
    if (!allowed) {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const [nameDup] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.canonicalName, canonicalName))
      .limit(1);
    if (nameDup) {
      return reply.status(409).send({ error: "Ingredient name already exists", code: "CANONICAL_NAME_TAKEN" });
    }
    const baseSlug = slugInput ?? slugifyCanonicalName(canonicalName);
    const slug = await ensureUniqueSlug(baseSlug);
    const [created] = await db
      .insert(ingredients)
      .values({
        canonicalName,
        slug,
        description: description ?? null,
        isCommonAllergen: false,
        commonAllergenGroup: null,
        approvalStatus: "pending",
        requestedByRestaurantId: restaurantId
      })
      .returning();
    return reply.status(201).send(created);
  });

  app.post<{ Params: { id: string } }>("/:id/approve", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role !== "superadmin") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const id = Number(request.params.id);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const [row] = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
    if (!row || row.approvalStatus !== "pending") {
      return reply.status(404).send({ error: "No pending ingredient", code: "NOT_PENDING" });
    }
    const [updated] = await db
      .update(ingredients)
      .set({ approvalStatus: "approved", requestedByRestaurantId: null })
      .where(eq(ingredients.id, id))
      .returning();
    return reply.send(updated);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role !== "superadmin") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const id = Number(request.params.id);
    if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
    const [row] = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
    if (!row) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    if (row.approvalStatus !== "pending") {
      return reply.status(400).send({ error: "Only pending ingredients can be rejected", code: "NOT_PENDING" });
    }
    const [used] = await db.select({ id: dishIngredients.id }).from(dishIngredients).where(eq(dishIngredients.ingredientId, id)).limit(1);
    if (used) {
      return reply
        .status(409)
        .send({ error: "Ingredient is in use; remove from dishes first", code: "IN_USE" });
    }
    await db.delete(ingredients).where(eq(ingredients.id, id));
    return reply.status(204).send();
  });
}
