import type { FastifyInstance } from "fastify";
import { eq, asc, max, inArray, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import { dishes, menuSections, menus, dishMedia, dishTranslations } from "@digital-menu/db";
import { createDishSchema, updateDishSchema, reorderDishMediaSchema, upsertTranslationSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";
import { localMediaStorage, saveMultipartImage, saveMultipartMedia } from "../lib/uploads.js";

function parsePrice(value: string | number): string {
  if (typeof value === "number") return String(value);
  return value;
}

type DishMediaRow = typeof dishMedia.$inferSelect;

function serializeMediaRows(rows: DishMediaRow[]) {
  return rows.map((m) => ({
    id: m.id,
    url: m.url,
    kind: m.kind,
    displayOrder: m.displayOrder
  }));
}

async function loadMediaByDishIds(dishIds: number[]): Promise<Map<number, DishMediaRow[]>> {
  const map = new Map<number, DishMediaRow[]>();
  if (dishIds.length === 0) return map;
  const rows = await db
    .select()
    .from(dishMedia)
    .where(inArray(dishMedia.dishId, dishIds))
    .orderBy(asc(dishMedia.displayOrder), asc(dishMedia.id));
  for (const row of rows) {
    const list = map.get(row.dishId) ?? [];
    list.push(row);
    map.set(row.dishId, list);
  }
  return map;
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
    const mediaMap = await loadMediaByDishIds(list.map((d) => d.id));
    return reply.send(
      list.map((d) => ({
        ...d,
        media: serializeMediaRows(mediaMap.get(d.id) ?? [])
      }))
    );
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
      return reply.status(201).send({ ...dish, media: [] });
    }
  );

  app.post<{ Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string } }>(
    "/:dishId/image",
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

      const file = await request.file();
      const saved = await saveMultipartImage(file, "dishes");
      if (!saved.ok) {
        return reply.status(saved.status).send({ error: saved.error, code: saved.code });
      }
      const [updated] = await db
        .update(dishes)
        .set({ imageUrl: saved.imageUrl })
        .where(eq(dishes.id, dishId))
        .returning();
      const mediaMap = await loadMediaByDishIds([dishId]);
      return reply.send({ imageUrl: saved.imageUrl, dish: { ...updated!, media: serializeMediaRows(mediaMap.get(dishId) ?? []) } });
    }
  );

  app.post<{ Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string } }>(
    "/:dishId/media",
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

      const file = await request.file();
      const saved = await saveMultipartMedia(file, "dishes", localMediaStorage);
      if (!saved.ok) {
        return reply.status(saved.status).send({ error: saved.error, code: saved.code });
      }

      const [maxRow] = await db
        .select({ m: max(dishMedia.displayOrder) })
        .from(dishMedia)
        .where(eq(dishMedia.dishId, dishId));
      const nextOrder = Number(maxRow?.m ?? -1) + 1;

      const [row] = await db
        .insert(dishMedia)
        .values({
          dishId,
          url: saved.url,
          kind: saved.kind,
          displayOrder: nextOrder
        })
        .returning();

      if (!row) return reply.status(500).send({ error: "Failed to save media" });
      return reply.status(201).send({ media: serializeMediaRows([row])[0] });
    }
  );

  app.patch<{
    Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string };
    Body: unknown;
  }>("/:dishId/media/order", async (request, reply) => {
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

    const parsed = reorderDishMediaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { orderedIds } = parsed.data;

    const existing = await db.select({ id: dishMedia.id }).from(dishMedia).where(eq(dishMedia.dishId, dishId));
    const idSet = new Set(existing.map((r) => r.id));
    if (orderedIds.length !== idSet.size) {
      return reply.status(400).send({ error: "orderedIds must list every media item exactly once" });
    }
    for (const id of orderedIds) {
      if (!idSet.has(id)) {
        return reply.status(400).send({ error: "Invalid media id for this dish" });
      }
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(dishMedia)
          .set({ displayOrder: i })
          .where(eq(dishMedia.id, orderedIds[i]!));
      }
    });

    const rows = await db
      .select()
      .from(dishMedia)
      .where(eq(dishMedia.dishId, dishId))
      .orderBy(asc(dishMedia.displayOrder), asc(dishMedia.id));
    return reply.send({ media: serializeMediaRows(rows) });
  });

  app.delete<{
    Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string; mediaId: string };
  }>("/:dishId/media/:mediaId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const sectionId = Number(request.params.sectionId);
    const dishId = Number(request.params.dishId);
    const mediaId = Number(request.params.mediaId);
    if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId) || Number.isNaN(mediaId)) {
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

    const [row] = await db.select().from(dishMedia).where(eq(dishMedia.id, mediaId)).limit(1);
    if (!row || row.dishId !== dishId) return reply.status(404).send({ error: "Media not found" });

    await db.delete(dishMedia).where(eq(dishMedia.id, mediaId));
    await localMediaStorage.deleteByPublicUrl(row.url);
    return reply.status(204).send();
  });

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
      const mediaMap = await loadMediaByDishIds([dishId]);
      return reply.send({ ...dish, media: serializeMediaRows(mediaMap.get(dishId) ?? []) });
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
      const mediaMap = await loadMediaByDishIds([dishId]);
      return reply.send({ ...updated!, media: serializeMediaRows(mediaMap.get(dishId) ?? []) });
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

  // ── Translation endpoints ────────────────────────────────────────────────

  /** Resolve dish and verify it belongs to the caller's restaurant. Returns the dish row or null. */
  async function resolveDish(
    restaurantId: number,
    sectionId: number,
    dishId: number,
    userId: number,
    role: string
  ) {
    const allowed = await canUserManageRestaurantWithRole(userId, role, restaurantId);
    if (!allowed) return null;
    const [dish] = await db.select().from(dishes).where(eq(dishes.id, dishId)).limit(1);
    if (!dish || dish.sectionId !== sectionId) return null;
    const [section] = await db.select().from(menuSections).where(eq(menuSections.id, sectionId)).limit(1);
    const [menu] = section
      ? await db.select().from(menus).where(eq(menus.id, section.menuId)).limit(1)
      : [null];
    if (!menu || menu.restaurantId !== restaurantId) return null;
    return dish;
  }

  /** GET /:dishId/translations — list all translations for a dish */
  app.get<{ Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string } }>(
    "/:dishId/translations",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      const restaurantId = Number(request.params.restaurantId);
      const sectionId = Number(request.params.sectionId);
      const dishId = Number(request.params.dishId);
      if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const dish = await resolveDish(restaurantId, sectionId, dishId, auth.user.userId, auth.user.role);
      if (!dish) return reply.status(404).send({ error: "Dish not found", code: "NOT_FOUND" });
      const rows = await db
        .select()
        .from(dishTranslations)
        .where(eq(dishTranslations.dishId, dishId))
        .orderBy(asc(dishTranslations.locale));
      return reply.send(rows);
    }
  );

  /** PUT /:dishId/translations/:locale — create or replace a translation */
  app.put<{
    Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string; locale: string };
    Body: unknown;
  }>("/:dishId/translations/:locale", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const sectionId = Number(request.params.sectionId);
    const dishId = Number(request.params.dishId);
    if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const dish = await resolveDish(restaurantId, sectionId, dishId, auth.user.userId, auth.user.role);
    if (!dish) return reply.status(404).send({ error: "Dish not found", code: "NOT_FOUND" });

    // Merge locale from path into body for unified validation
    const parsed = upsertTranslationSchema.safeParse({
      ...(typeof request.body === "object" && request.body !== null ? request.body : {}),
      locale: request.params.locale
    });
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { locale, name, description } = parsed.data;

    const [existing] = await db
      .select({ id: dishTranslations.id })
      .from(dishTranslations)
      .where(and(eq(dishTranslations.dishId, dishId), eq(dishTranslations.locale, locale)))
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(dishTranslations)
        .set({ name, description: description ?? null })
        .where(eq(dishTranslations.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(dishTranslations)
        .values({ dishId, locale, name, description: description ?? null })
        .returning();
    }
    return reply.status(existing ? 200 : 201).send(row);
  });

  /** DELETE /:dishId/translations/:locale — remove a single locale translation */
  app.delete<{
    Params: { restaurantId: string; menuId: string; sectionId: string; dishId: string; locale: string };
  }>("/:dishId/translations/:locale", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const restaurantId = Number(request.params.restaurantId);
    const sectionId = Number(request.params.sectionId);
    const dishId = Number(request.params.dishId);
    if (Number.isNaN(restaurantId) || Number.isNaN(sectionId) || Number.isNaN(dishId)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const dish = await resolveDish(restaurantId, sectionId, dishId, auth.user.userId, auth.user.role);
    if (!dish) return reply.status(404).send({ error: "Dish not found", code: "NOT_FOUND" });
    const locale = request.params.locale;
    await db
      .delete(dishTranslations)
      .where(and(eq(dishTranslations.dishId, dishId), eq(dishTranslations.locale, locale)));
    return reply.status(204).send();
  });
}
