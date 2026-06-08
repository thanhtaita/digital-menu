import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { recommendations, recommendationFeedback, dishes } from "@digital-menu/db";
import { recommendationFeedbackSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { getRecommendations } from "../services/recommendation.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function recommendationRoutes(app: FastifyInstance) {
  app.get("/users/me/recommendations", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const query = request.query as { restaurantId?: string; limit?: string };
    const restaurantId = query.restaurantId ? parseInt(query.restaurantId, 10) : undefined;
    const limit = Math.min(
      query.limit ? parseInt(query.limit, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT,
      MAX_LIMIT
    );

    if (restaurantId !== undefined && isNaN(restaurantId)) {
      return reply.status(400).send({ error: "Invalid restaurantId" });
    }

    const result = await getRecommendations({ userId: auth.user.userId, restaurantId, limit });

    if (result.status === "no_preference") {
      return reply.status(400).send({
        error: "No preference set",
        code: "NO_PREFERENCE",
        message: "Set your food preferences first via PUT /users/me/preferences"
      });
    }

    if (result.status === "embedding_pending") {
      return reply.status(202).send({
        message: "Your preference is queued for embedding. Check back shortly.",
        code: "EMBEDDING_PENDING",
        preferenceText: result.preferenceText
      });
    }

    return reply.send({
      recommendations: result.recommendations,
      metadata: {
        basedOn: result.preferenceText,
        generatedAt: new Date().toISOString(),
        preferenceEmbedded: true
      }
    });
  });

  app.post("/recommendations/:id/feedback", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid id" });

    const parsed = recommendationFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const [rec] = await db
      .select({ id: recommendations.id })
      .from(recommendations)
      .where(and(eq(recommendations.id, id), eq(recommendations.userId, auth.user.userId)))
      .limit(1);

    if (!rec) return reply.status(404).send({ error: "Recommendation not found" });

    const [feedback] = await db
      .insert(recommendationFeedback)
      .values({ recommendationId: id, userId: auth.user.userId, action: parsed.data.action })
      .returning();

    return reply.status(201).send({ feedback });
  });

  app.get("/users/me/recommendations/history", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || 20, 100);
    const offset = parseInt(query.offset ?? "0", 10) || 0;

    const rows = await db
      .select({
        id: recommendations.id,
        dishId: recommendations.dishId,
        similarityScore: recommendations.similarityScore,
        rank: recommendations.rank,
        shownAt: recommendations.shownAt,
        dish: { name: dishes.name, description: dishes.description, imageUrl: dishes.imageUrl }
      })
      .from(recommendations)
      .leftJoin(dishes, eq(recommendations.dishId, dishes.id))
      .where(eq(recommendations.userId, auth.user.userId))
      .orderBy(desc(recommendations.shownAt))
      .limit(limit)
      .offset(offset);

    return reply.send({ history: rows, limit, offset });
  });
}
