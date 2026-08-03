import type { FastifyInstance } from "fastify";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, ilike, inArray, max, or } from "drizzle-orm";
import {
  createIngredientSchema,
  requestIngredientSchema,
  reorderIngredientMediaSchema,
  updateIngredientSchema,
  upsertTranslationSchema,
} from "@digital-menu/shared";
import { db } from "../lib/db.js";
import {
  dishIngredients,
  ingredients,
  ingredientAliases,
  ingredientDietCandidates,
  ingredientFdcCandidates,
  ingredientMedia,
  ingredientTranslations,
  aiContentTranslations,
  restaurants,
} from "@digital-menu/db";
import { requireAuth } from "../middleware/auth.js";
import {
  canUserManageRestaurant,
  getRestaurantIdsManagedByUser,
} from "../lib/restaurant-access.js";
import { getSession, getSessionIdFromCookie } from "../lib/auth.js";
import { SEARCH_RATE_LIMIT } from "../lib/rate-limit.js";
import {
  mediaStorage,
  saveMultipartImage,
  saveMultipartMedia,
} from "../lib/uploads.js";
import { applyFdcMatch, fetchFdcFullDetail } from "../services/fdc-matching.js";
import { applyDietTag } from "../services/diet-tagging.js";

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
    const [row] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.slug, candidate))
      .limit(1);
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
    and(
      eq(ingredients.approvalStatus, "pending"),
      inArray(ingredients.requestedByRestaurantId, restaurantIds),
    ),
  )!;
}

type IngredientMediaRow = typeof ingredientMedia.$inferSelect;

function serializeIngredientMediaRows(rows: IngredientMediaRow[]) {
  return rows.map((m) => ({
    id: m.id,
    url: m.url,
    kind: m.kind,
    displayOrder: m.displayOrder,
  }));
}

async function loadMediaByIngredientIds(
  ids: number[],
): Promise<Map<number, IngredientMediaRow[]>> {
  const map = new Map<number, IngredientMediaRow[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select()
    .from(ingredientMedia)
    .where(inArray(ingredientMedia.ingredientId, ids))
    .orderBy(asc(ingredientMedia.displayOrder), asc(ingredientMedia.id));
  for (const row of rows) {
    const list = map.get(row.ingredientId) ?? [];
    list.push(row);
    map.set(row.ingredientId, list);
  }
  return map;
}

async function ingredientWithMedia(row: typeof ingredients.$inferSelect) {
  const mediaMap = await loadMediaByIngredientIds([row.id]);
  return {
    ...row,
    media: serializeIngredientMediaRows(mediaMap.get(row.id) ?? []),
  };
}

async function canEditIngredientMedia(
  userId: number,
  role: string,
  row: typeof ingredients.$inferSelect,
): Promise<boolean> {
  if (role === "superadmin") return true;
  if (row.approvalStatus === "pending" && row.requestedByRestaurantId != null) {
    return canUserManageRestaurant(userId, row.requestedByRestaurantId);
  }
  return false;
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
        restaurantName: restaurants.name,
      })
      .from(ingredients)
      .leftJoin(
        restaurants,
        eq(ingredients.requestedByRestaurantId, restaurants.id),
      )
      .where(eq(ingredients.approvalStatus, "pending"))
      .orderBy(asc(ingredients.id));
    return reply.send(list);
  });

  // ── FDC nutrition match review queue ────────────────────────────────────

  /** GET /fdc-candidates — pending USDA FoodData Central match candidates awaiting superadmin review. */
  app.get("/fdc-candidates", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role !== "superadmin") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const rows = await db
      .select({
        id: ingredientFdcCandidates.id,
        ingredientId: ingredientFdcCandidates.ingredientId,
        ingredientCanonicalName: ingredients.canonicalName,
        fdcId: ingredientFdcCandidates.fdcId,
        fdcDescription: ingredientFdcCandidates.fdcDescription,
        fdcDataType: ingredientFdcCandidates.fdcDataType,
        score: ingredientFdcCandidates.score,
        status: ingredientFdcCandidates.status,
        createdAt: ingredientFdcCandidates.createdAt,
      })
      .from(ingredientFdcCandidates)
      .innerJoin(
        ingredients,
        eq(ingredientFdcCandidates.ingredientId, ingredients.id),
      )
      .where(eq(ingredientFdcCandidates.status, "pending"))
      .orderBy(
        asc(ingredients.canonicalName),
        desc(ingredientFdcCandidates.score),
      );
    return reply.send(
      rows.map((r) => ({
        ...r,
        score: Number(r.score),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  });

  /**
   * GET /fdc-candidates/:id/detail — everything a superadmin needs to judge one match: the full
   * ingredient (incl. aliases, media, any nutrients already on it) side by side with the full fdc.*
   * record (every recorded nutrient, not just the fixed macro set, plus household portions).
   */
  app.get<{ Params: { id: string } }>(
    "/fdc-candidates/:id/detail",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });

      const [candidate] = await db
        .select()
        .from(ingredientFdcCandidates)
        .where(eq(ingredientFdcCandidates.id, id))
        .limit(1);
      if (!candidate)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });

      const [ingredient] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, candidate.ingredientId))
        .limit(1);
      if (!ingredient)
        return reply
          .status(404)
          .send({ error: "Ingredient not found", code: "NOT_FOUND" });

      const [aliasRows, mediaMap, fdc] = await Promise.all([
        db
          .select()
          .from(ingredientAliases)
          .where(eq(ingredientAliases.ingredientId, ingredient.id)),
        loadMediaByIngredientIds([ingredient.id]),
        fetchFdcFullDetail(candidate.fdcId),
      ]);

      return reply.send({
        candidate: {
          id: candidate.id,
          fdcId: candidate.fdcId,
          fdcDescription: candidate.fdcDescription,
          fdcDataType: candidate.fdcDataType,
          score: Number(candidate.score),
          status: candidate.status,
          createdAt: candidate.createdAt.toISOString(),
        },
        ingredient: {
          ...ingredient,
          media: serializeIngredientMediaRows(
            mediaMap.get(ingredient.id) ?? [],
          ),
          aliases: aliasRows.map((a) => ({
            id: a.id,
            alias: a.alias,
            languageCode: a.languageCode,
          })),
        },
        fdc,
      });
    },
  );

  /** POST /fdc-candidates/:id/accept — copy nutrients/food category into the ingredient and set fdc_id. */
  app.post<{ Params: { id: string } }>(
    "/fdc-candidates/:id/accept",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select()
        .from(ingredientFdcCandidates)
        .where(eq(ingredientFdcCandidates.id, id))
        .limit(1);
      if (!row || row.status !== "pending") {
        return reply
          .status(404)
          .send({ error: "No pending candidate", code: "NOT_PENDING" });
      }
      await applyFdcMatch({ ingredientId: row.ingredientId, fdcId: row.fdcId });
      const [updated] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, row.ingredientId))
        .limit(1);
      return reply.send(await ingredientWithMedia(updated!));
    },
  );

  /** POST /fdc-candidates/:id/reject — dismiss a candidate without touching the ingredient. */
  app.post<{ Params: { id: string } }>(
    "/fdc-candidates/:id/reject",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select({
          id: ingredientFdcCandidates.id,
          status: ingredientFdcCandidates.status,
        })
        .from(ingredientFdcCandidates)
        .where(eq(ingredientFdcCandidates.id, id))
        .limit(1);
      if (!row || row.status !== "pending") {
        return reply
          .status(404)
          .send({ error: "No pending candidate", code: "NOT_PENDING" });
      }
      await db
        .update(ingredientFdcCandidates)
        .set({ status: "rejected", resolvedAt: new Date() })
        .where(eq(ingredientFdcCandidates.id, id));
      return reply.status(204).send();
    },
  );

  // ── Diet-tag review queue ───────────────────────────────────────────────

  /** GET /diet-candidates — pending LLM-proposed diet-compatibility tags awaiting superadmin review. */
  app.get("/diet-candidates", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role !== "superadmin") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const rows = await db
      .select({
        id: ingredientDietCandidates.id,
        ingredientId: ingredientDietCandidates.ingredientId,
        ingredientCanonicalName: ingredients.canonicalName,
        dietType: ingredientDietCandidates.dietType,
        compatible: ingredientDietCandidates.compatible,
        confidence: ingredientDietCandidates.confidence,
        reasoning: ingredientDietCandidates.reasoning,
        status: ingredientDietCandidates.status,
        createdAt: ingredientDietCandidates.createdAt,
      })
      .from(ingredientDietCandidates)
      .innerJoin(
        ingredients,
        eq(ingredientDietCandidates.ingredientId, ingredients.id),
      )
      .where(eq(ingredientDietCandidates.status, "pending"))
      .orderBy(
        asc(ingredients.canonicalName),
        asc(ingredientDietCandidates.dietType),
      );
    return reply.send(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    );
  });

  /** POST /diet-candidates/:id/accept — merge the proposed tag into the ingredient's diet_tags. */
  app.post<{ Params: { id: string } }>(
    "/diet-candidates/:id/accept",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select()
        .from(ingredientDietCandidates)
        .where(eq(ingredientDietCandidates.id, id))
        .limit(1);
      if (!row || row.status !== "pending") {
        return reply
          .status(404)
          .send({ error: "No pending candidate", code: "NOT_PENDING" });
      }
      await applyDietTag({
        ingredientId: row.ingredientId,
        dietType: row.dietType as Parameters<
          typeof applyDietTag
        >[0]["dietType"],
        compatible: row.compatible,
      });
      const [updated] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, row.ingredientId))
        .limit(1);
      return reply.send(await ingredientWithMedia(updated!));
    },
  );

  /** POST /diet-candidates/:id/reject — dismiss a candidate without touching the ingredient. */
  app.post<{ Params: { id: string } }>(
    "/diet-candidates/:id/reject",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select({
          id: ingredientDietCandidates.id,
          status: ingredientDietCandidates.status,
        })
        .from(ingredientDietCandidates)
        .where(eq(ingredientDietCandidates.id, id))
        .limit(1);
      if (!row || row.status !== "pending") {
        return reply
          .status(404)
          .send({ error: "No pending candidate", code: "NOT_PENDING" });
      }
      await db
        .update(ingredientDietCandidates)
        .set({ status: "rejected", resolvedAt: new Date() })
        .where(eq(ingredientDietCandidates.id, id));
      return reply.status(204).send();
    },
  );

  app.get<{
    Querystring: { q?: string; limit?: number; offset?: number };
  }>(
    "/",
    { config: { rateLimit: SEARCH_RATE_LIMIT } },
    async (request, reply) => {
      const q = request.query.q?.trim();
      const limit = Number(request.query.limit) || (q ? 30 : 20);
      const offset = Number(request.query.offset) || 0;
      const sessionId = getSessionIdFromCookie(request.headers.cookie);
      const sessionUser = await getSession(sessionId);
      const restaurantIds = sessionUser
        ? await getRestaurantIdsManagedByUser(sessionUser.userId)
        : [];
      const vis = visibilityWhere(restaurantIds);

      const list = !q
        ? await db
            .select()
            .from(ingredients)
            .where(vis)
            .orderBy(asc(ingredients.canonicalName))
            .limit(limit)
            .offset(offset)
        : await db
            .select()
            .from(ingredients)
            .where(and(vis, ilike(ingredients.canonicalName, `%${q}%`)))
            .limit(limit);

      const mediaMap = await loadMediaByIngredientIds(list.map((i) => i.id));
      return reply.send(
        list.map((i) => ({
          ...i,
          media: serializeIngredientMediaRows(mediaMap.get(i.id) ?? []),
        })),
      );
    },
  );

  app.post<{ Body: unknown }>("/", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role === "diner") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }

    if (auth.user.role === "superadmin") {
      const parsed = createIngredientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send({
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
      }
      const {
        canonicalName,
        slug: slugInput,
        description,
        imageUrl,
        isCommonAllergen,
        commonAllergenGroup,
      } = parsed.data;
      const [nameDup] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.canonicalName, canonicalName))
        .limit(1);
      if (nameDup) {
        return reply
          .status(409)
          .send({
            error: "Ingredient name already exists",
            code: "CANONICAL_NAME_TAKEN",
          });
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
          requestedByRestaurantId: null,
        })
        .returning();
      if (!created)
        return reply.status(500).send({ error: "Failed to create ingredient" });
      return reply.status(201).send(await ingredientWithMedia(created));
    }

    const parsed = requestIngredientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(422)
        .send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const {
      canonicalName,
      slug: slugInput,
      description,
      restaurantId,
    } = parsed.data;
    const allowed = await canUserManageRestaurant(
      auth.user.userId,
      restaurantId,
    );
    if (!allowed) {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const [nameDup] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.canonicalName, canonicalName))
      .limit(1);
    if (nameDup) {
      return reply
        .status(409)
        .send({
          error: "Ingredient name already exists",
          code: "CANONICAL_NAME_TAKEN",
        });
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
        requestedByRestaurantId: restaurantId,
      })
      .returning();
    if (!created)
      return reply.status(500).send({ error: "Failed to create ingredient" });
    return reply.status(201).send(await ingredientWithMedia(created));
  });

  app.post<{ Params: { id: string } }>("/:id/media", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role === "diner") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const id = Number(request.params.id);
    if (Number.isNaN(id))
      return reply.status(400).send({ error: "Invalid id" });
    const [row] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);
    if (!row)
      return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    if (
      !(await canEditIngredientMedia(auth.user.userId, auth.user.role, row))
    ) {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }

    const file = await request.file();
    const saved = await saveMultipartMedia(
      file,
      "ingredients",
      mediaStorage,
    );
    if (!saved.ok) {
      return reply
        .status(saved.status)
        .send({ error: saved.error, code: saved.code });
    }

    const [maxRow] = await db
      .select({ m: max(ingredientMedia.displayOrder) })
      .from(ingredientMedia)
      .where(eq(ingredientMedia.ingredientId, id));
    const nextOrder = Number(maxRow?.m ?? -1) + 1;

    const [mediaRow] = await db
      .insert(ingredientMedia)
      .values({
        ingredientId: id,
        url: saved.url,
        kind: saved.kind,
        displayOrder: nextOrder,
      })
      .returning();

    if (!mediaRow)
      return reply.status(500).send({ error: "Failed to save media" });

    const mediaList = await db
      .select()
      .from(ingredientMedia)
      .where(eq(ingredientMedia.ingredientId, id))
      .orderBy(asc(ingredientMedia.displayOrder), asc(ingredientMedia.id));
    const firstImage = mediaList.find((m) => m.kind === "image");
    await db
      .update(ingredients)
      .set({ imageUrl: firstImage?.url ?? row.imageUrl })
      .where(eq(ingredients.id, id));

    return reply
      .status(201)
      .send({ media: serializeIngredientMediaRows([mediaRow])[0] });
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/:id/media/order",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role === "diner") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!row)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });
      if (
        !(await canEditIngredientMedia(auth.user.userId, auth.user.role, row))
      ) {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      const parsed = reorderIngredientMediaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send({
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
      }
      const { orderedIds } = parsed.data;

      const existing = await db
        .select({ id: ingredientMedia.id })
        .from(ingredientMedia)
        .where(eq(ingredientMedia.ingredientId, id));
      const idSet = new Set(existing.map((r) => r.id));
      if (orderedIds.length !== idSet.size) {
        return reply
          .status(400)
          .send({
            error: "orderedIds must list every media item exactly once",
          });
      }
      for (const mid of orderedIds) {
        if (!idSet.has(mid)) {
          return reply
            .status(400)
            .send({ error: "Invalid media id for this ingredient" });
        }
      }

      await db.transaction(async (tx) => {
        for (let i = 0; i < orderedIds.length; i++) {
          await tx
            .update(ingredientMedia)
            .set({ displayOrder: i })
            .where(eq(ingredientMedia.id, orderedIds[i]!));
        }
      });

      const mediaList = await db
        .select()
        .from(ingredientMedia)
        .where(eq(ingredientMedia.ingredientId, id))
        .orderBy(asc(ingredientMedia.displayOrder), asc(ingredientMedia.id));
      const firstImage = mediaList.find((m) => m.kind === "image");
      await db
        .update(ingredients)
        .set({ imageUrl: firstImage?.url ?? null })
        .where(eq(ingredients.id, id));

      return reply.send({ media: serializeIngredientMediaRows(mediaList) });
    },
  );

  app.delete<{ Params: { id: string; mediaId: string } }>(
    "/:id/media/:mediaId",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role === "diner") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      const mediaId = Number(request.params.mediaId);
      if (Number.isNaN(id) || Number.isNaN(mediaId)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const [row] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!row)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });
      if (
        !(await canEditIngredientMedia(auth.user.userId, auth.user.role, row))
      ) {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      const [mediaRow] = await db
        .select()
        .from(ingredientMedia)
        .where(eq(ingredientMedia.id, mediaId))
        .limit(1);
      if (!mediaRow || mediaRow.ingredientId !== id) {
        return reply
          .status(404)
          .send({ error: "Media not found", code: "NOT_FOUND" });
      }

      await db.delete(ingredientMedia).where(eq(ingredientMedia.id, mediaId));
      await mediaStorage.deleteByPublicUrl(mediaRow.url);

      const mediaList = await db
        .select()
        .from(ingredientMedia)
        .where(eq(ingredientMedia.ingredientId, id))
        .orderBy(asc(ingredientMedia.displayOrder), asc(ingredientMedia.id));
      const firstImage = mediaList.find((m) => m.kind === "image");
      await db
        .update(ingredients)
        .set({ imageUrl: firstImage?.url ?? null })
        .where(eq(ingredients.id, id));

      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string } }>("/:id/image", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role === "diner") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const id = Number(request.params.id);
    if (Number.isNaN(id))
      return reply.status(400).send({ error: "Invalid id" });
    const [row] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);
    if (!row)
      return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });

    if (
      !(await canEditIngredientMedia(auth.user.userId, auth.user.role, row))
    ) {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }

    const file = await request.file();
    const saved = await saveMultipartImage(file, "ingredients");
    if (!saved.ok) {
      return reply
        .status(saved.status)
        .send({ error: saved.error, code: saved.code });
    }

    const [maxRow] = await db
      .select({ m: max(ingredientMedia.displayOrder) })
      .from(ingredientMedia)
      .where(eq(ingredientMedia.ingredientId, id));
    const nextOrder = Number(maxRow?.m ?? -1) + 1;

    await db.insert(ingredientMedia).values({
      ingredientId: id,
      url: saved.imageUrl,
      kind: "image",
      displayOrder: nextOrder,
    });

    const [updated] = await db
      .update(ingredients)
      .set({ imageUrl: saved.imageUrl })
      .where(eq(ingredients.id, id))
      .returning();

    return reply.send({
      imageUrl: saved.imageUrl,
      ingredient: await ingredientWithMedia(updated!),
    });
  });

  app.post<{ Params: { id: string } }>(
    "/:id/approve",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!row || row.approvalStatus !== "pending") {
        return reply
          .status(404)
          .send({ error: "No pending ingredient", code: "NOT_PENDING" });
      }
      const [updated] = await db
        .update(ingredients)
        .set({ approvalStatus: "approved", requestedByRestaurantId: null })
        .where(eq(ingredients.id, id))
        .returning();
      return reply.send(await ingredientWithMedia(updated!));
    },
  );

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/:id",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!row)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });

      const parsed = updateIngredientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(422)
          .send({
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
      }
      const {
        canonicalName,
        description,
        isCommonAllergen,
        commonAllergenGroup,
      } = parsed.data;

      if (canonicalName !== undefined && canonicalName !== row.canonicalName) {
        const [nameDup] = await db
          .select({ id: ingredients.id })
          .from(ingredients)
          .where(eq(ingredients.canonicalName, canonicalName))
          .limit(1);
        if (nameDup) {
          return reply
            .status(409)
            .send({
              error: "Ingredient name already exists",
              code: "CANONICAL_NAME_TAKEN",
            });
        }
      }

      const updates: Partial<typeof ingredients.$inferInsert> = {};
      if (canonicalName !== undefined) updates.canonicalName = canonicalName;
      if (description !== undefined) updates.description = description;
      if (isCommonAllergen !== undefined)
        updates.isCommonAllergen = isCommonAllergen;
      if (commonAllergenGroup !== undefined)
        updates.commonAllergenGroup = commonAllergenGroup;

      const [updated] = await db
        .update(ingredients)
        .set(updates)
        .where(eq(ingredients.id, id))
        .returning();
      if (!updated) return reply.status(500).send({ error: "Update failed" });
      return reply.send(await ingredientWithMedia(updated));
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (auth.user.role !== "superadmin") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }
    const id = Number(request.params.id);
    if (Number.isNaN(id))
      return reply.status(400).send({ error: "Invalid id" });
    const [row] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);
    if (!row)
      return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    const [used] = await db
      .select({ id: dishIngredients.id })
      .from(dishIngredients)
      .where(eq(dishIngredients.ingredientId, id))
      .limit(1);
    if (used) {
      return reply
        .status(409)
        .send({
          error:
            "Ingredient is in use by one or more dishes; remove it from those dishes first",
          code: "IN_USE",
        });
    }
    await db.delete(ingredients).where(eq(ingredients.id, id));
    return reply.status(204).send();
  });

  // ── Translation endpoints ────────────────────────────────────────────────

  /** GET /:id/translations — list all translations for an ingredient */
  app.get<{ Params: { id: string } }>(
    "/:id/translations",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!row)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });
      const rows = await db
        .select()
        .from(ingredientTranslations)
        .where(eq(ingredientTranslations.ingredientId, id))
        .orderBy(asc(ingredientTranslations.locale));
      return reply.send(rows);
    },
  );

  /**
   * GET /:id/ai-translations — list AI-generated cache entries for an ingredient, superadmin only
   * (i18n-scout-m3 captain decision #6 - AI-vs-human provenance is a superadmin-only view).
   */
  app.get<{ Params: { id: string } }>(
    "/:id/ai-translations",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id)) return reply.status(400).send({ error: "Invalid id" });
      const [row] = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.id, id)).limit(1);
      if (!row) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
      const rows = await db
        .select()
        .from(aiContentTranslations)
        .where(and(eq(aiContentTranslations.entityType, "ingredient"), eq(aiContentTranslations.entityId, id)))
        .orderBy(asc(aiContentTranslations.locale), asc(aiContentTranslations.field));
      return reply.send(rows);
    },
  );

  /** PUT /:id/translations/:locale — create or replace a translation */
  app.put<{ Params: { id: string; locale: string }; Body: unknown }>(
    "/:id/translations/:locale",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [ingRow] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!ingRow)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });

      const parsed = upsertTranslationSchema.safeParse({
        ...(typeof request.body === "object" && request.body !== null
          ? request.body
          : {}),
        locale: request.params.locale,
      });
      if (!parsed.success) {
        return reply
          .status(422)
          .send({
            error: "Validation failed",
            details: parsed.error.flatten(),
          });
      }
      const { locale, name, description } = parsed.data;

      const [existing] = await db
        .select({ id: ingredientTranslations.id })
        .from(ingredientTranslations)
        .where(
          and(
            eq(ingredientTranslations.ingredientId, id),
            eq(ingredientTranslations.locale, locale),
          ),
        )
        .limit(1);

      let translationRow;
      if (existing) {
        [translationRow] = await db
          .update(ingredientTranslations)
          .set({ name, description: description ?? null })
          .where(eq(ingredientTranslations.id, existing.id))
          .returning();
      } else {
        [translationRow] = await db
          .insert(ingredientTranslations)
          .values({
            ingredientId: id,
            locale,
            name,
            description: description ?? null,
          })
          .returning();
      }
      return reply.status(existing ? 200 : 201).send(translationRow);
    },
  );

  /** DELETE /:id/translations/:locale — remove a single locale translation */
  app.delete<{ Params: { id: string; locale: string } }>(
    "/:id/translations/:locale",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;
      if (auth.user.role !== "superadmin") {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      const id = Number(request.params.id);
      if (Number.isNaN(id))
        return reply.status(400).send({ error: "Invalid id" });
      const [ingRow] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.id, id))
        .limit(1);
      if (!ingRow)
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });
      const locale = request.params.locale;
      await db
        .delete(ingredientTranslations)
        .where(
          and(
            eq(ingredientTranslations.ingredientId, id),
            eq(ingredientTranslations.locale, locale),
          ),
        );
      return reply.status(204).send();
    },
  );
}
