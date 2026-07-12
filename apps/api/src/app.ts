import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { ensureUploadRoot, getUploadRoot, MAX_MULTIPART_BYTES } from "./lib/uploads.js";
import { rateLimitKeyGenerator } from "./lib/rate-limit.js";
import { ensureAiChatLogsRoot } from "./lib/ai-chat-logger.js";
import { healthRoutes } from "./routes/health.js";
import { ingredientRoutes } from "./routes/ingredients.js";
import { authRoutes } from "./routes/auth.js";
import { restaurantRoutes } from "./routes/restaurants.js";
import { menuRoutes } from "./routes/menus.js";
import { sectionRoutes } from "./routes/sections.js";
import { dishRoutes } from "./routes/dishes.js";
import { dishIngredientRoutes } from "./routes/dish-ingredients.js";
import { publicMenuRoutes } from "./routes/public-menu.js";
import { restrictionRoutes } from "./routes/restrictions.js";
import { qrRoutes } from "./routes/qr.js";
import { aiSuggestionRoutes } from "./routes/ai-suggestions.js";
import { preferenceRoutes } from "./routes/preferences.js";
import { recommendationRoutes } from "./routes/recommendations.js";
import { socialPostRoutes } from "./routes/social-posts.js";
import { socialFeedRoutes } from "./routes/social-feed.js";
import { socialFollowRoutes } from "./routes/social-follows.js";
import { socialProfileRoutes } from "./routes/social-profiles.js";
import { aiChatRoutes } from "./routes/ai-chat.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { parseOptions: {} });
  // global: false — only routes that opt in via `config: { rateLimit: {...} }` are throttled
  // (the LLM-backed AI routes and the ingredient search endpoint; see route files for limits).
  await app.register(rateLimit, { global: false, keyGenerator: rateLimitKeyGenerator });

  await ensureUploadRoot();
  await ensureAiChatLogsRoot();
  await app.register(multipart, {
    limits: { fileSize: MAX_MULTIPART_BYTES }
  });
  await app.register(fastifyStatic, {
    root: getUploadRoot(),
    prefix: "/uploads/",
    decorateReply: false
  });

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(ingredientRoutes, { prefix: "/api/v1/ingredients" });
  await app.register(restaurantRoutes, { prefix: "/api/v1/restaurants" });
  await app.register(menuRoutes, { prefix: "/api/v1/restaurants/:restaurantId/menus" });
  await app.register(sectionRoutes, { prefix: "/api/v1/restaurants/:restaurantId/menus/:menuId/sections" });
  await app.register(dishRoutes, {
    prefix: "/api/v1/restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes"
  });
  await app.register(dishIngredientRoutes, { prefix: "/api/v1/dishes/:dishId/ingredients" });
  await app.register(publicMenuRoutes, { prefix: "/api/v1/public" });
  await app.register(restrictionRoutes, { prefix: "/api/v1" });
  await app.register(qrRoutes, { prefix: "/api/v1" });
  await app.register(aiSuggestionRoutes, { prefix: "/api/v1" });
  await app.register(preferenceRoutes, { prefix: "/api/v1" });
  await app.register(recommendationRoutes, { prefix: "/api/v1" });
  await app.register(socialPostRoutes, { prefix: "/api/v1" });
  await app.register(socialFeedRoutes, { prefix: "/api/v1" });
  await app.register(socialFollowRoutes, { prefix: "/api/v1" });
  await app.register(socialProfileRoutes, { prefix: "/api/v1" });
  await app.register(aiChatRoutes, { prefix: "/api/v1/public" });

  return app;
}
