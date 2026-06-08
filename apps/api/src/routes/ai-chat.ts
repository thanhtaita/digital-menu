import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db } from "../lib/db.js";
import { restaurants } from "@digital-menu/db";
import { sendChatMessageSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { isAiNotConfiguredError } from "../lib/ai/index.js";
import { processChat, getChatHistory, clearChatSession } from "../services/ai-chat.js";

async function resolveRestaurant(slug: string): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(and(eq(restaurants.slug, slug), eq(restaurants.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function aiChatRoutes(app: FastifyInstance) {
  app.post<{ Params: { slug: string } }>("/restaurants/:slug/chat", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const restaurant = await resolveRestaurant(request.params.slug);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    const parsed = sendChatMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    try {
      const result = await processChat({
        userId: auth.user.userId,
        restaurantId: restaurant.id,
        message: parsed.data.message
      });
      return reply.send(result);
    } catch (err: unknown) {
      if (isAiNotConfiguredError(err)) {
        return reply.status(503).send({ error: "AI chat is not configured", code: "AI_NOT_CONFIGURED" });
      }
      request.log.error({ err }, "AI chat failed");
      return reply.status(502).send({ error: "Failed to get AI response. Please try again.", code: "AI_ERROR" });
    }
  });

  app.get<{ Params: { slug: string } }>("/restaurants/:slug/chat/history", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const restaurant = await resolveRestaurant(request.params.slug);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    const history = await getChatHistory({ userId: auth.user.userId, restaurantId: restaurant.id });
    return reply.send(history);
  });

  app.delete<{ Params: { slug: string } }>("/restaurants/:slug/chat", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const restaurant = await resolveRestaurant(request.params.slug);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    await clearChatSession({ userId: auth.user.userId, restaurantId: restaurant.id });
    return reply.status(204).send();
  });
}
