import type { FastifyInstance } from "fastify";
import { suggestIngredientsRequestSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";
import { isAiNotConfiguredError } from "../lib/ai/index.js";
import { suggestIngredients } from "../services/ai-ingredient-suggestion.js";
import { LLM_RATE_LIMIT } from "../lib/rate-limit.js";

export async function aiSuggestionRoutes(app: FastifyInstance) {
  app.post("/dishes/suggest-ingredients", { config: { rateLimit: LLM_RATE_LIMIT } }, async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    if (auth.user.role === "diner") {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }

    const parsed = suggestIngredientsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { dishName, description, contextPrompt, cuisineType, restaurantId } = parsed.data;

    const allowed = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, restaurantId);
    if (!allowed) {
      return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
    }

    try {
      const result = await suggestIngredients({ dishName, description, contextPrompt, cuisineType, restaurantId });
      return reply.send(result);
    } catch (err: unknown) {
      if (isAiNotConfiguredError(err)) {
        return reply.status(503).send({ error: "AI suggestions are not configured", code: "AI_NOT_CONFIGURED" });
      }
      request.log.error({ err }, "AI suggestion failed");
      return reply.status(502).send({ error: "Failed to generate suggestions. Please try again.", code: "AI_ERROR" });
    }
  });
}
