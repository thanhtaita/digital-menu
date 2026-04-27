import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ensureUploadRoot, getUploadRoot, MAX_MULTIPART_BYTES } from "./lib/uploads.js";
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

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { parseOptions: {} });

  await ensureUploadRoot();
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

  return app;
}
