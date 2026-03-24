import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { healthRoutes } from "./routes/health.js";
import { ingredientRoutes } from "./routes/ingredients.js";
import { authRoutes } from "./routes/auth.js";
import { restaurantRoutes } from "./routes/restaurants.js";
import { menuRoutes } from "./routes/menus.js";
import { sectionRoutes } from "./routes/sections.js";
import { dishRoutes } from "./routes/dishes.js";
import { dishIngredientRoutes } from "./routes/dish-ingredients.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { parseOptions: {} });

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

  return app;
}
