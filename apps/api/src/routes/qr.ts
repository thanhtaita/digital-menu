import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "../lib/db.js";
import { restaurants } from "@digital-menu/db";
import { requireAuth } from "../middleware/auth.js";
import { canUserManageRestaurantWithRole } from "../lib/restaurant-access.js";

const DINER_APP_URL = process.env.DINER_APP_URL ?? "http://localhost:3003";

export async function qrRoutes(app: FastifyInstance) {
  app.get("/restaurants/:id/qr", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) return reply.status(400).send({ error: "Invalid id" });

    const [restaurant] = await db
      .select({ id: restaurants.id, slug: restaurants.slug })
      .from(restaurants)
      .where(eq(restaurants.id, id))
      .limit(1);
    if (!restaurant) return reply.status(404).send({ error: "Restaurant not found" });

    const canManage = await canUserManageRestaurantWithRole(auth.user.userId, auth.user.role, id);
    if (!canManage) return reply.status(403).send({ error: "Forbidden" });

    const menuUrl = `${DINER_APP_URL}/r/${restaurant.slug}`;
    const png = await QRCode.toBuffer(menuUrl, { type: "png", width: 400, margin: 2 });

    reply.header("Content-Type", "image/png");
    reply.header("Content-Disposition", `inline; filename="qr-${restaurant.slug}.png"`);
    return reply.send(png);
  });
}
