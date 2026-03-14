import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { ingredientRoutes } from "./routes/ingredients.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(ingredientRoutes, { prefix: "/api/v1/ingredients" });

  return app;
}
