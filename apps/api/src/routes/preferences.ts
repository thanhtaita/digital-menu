import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { userPreferences, userPreferenceEmbeddings } from "@digital-menu/db";
import { updateUserPreferenceSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";

export async function preferenceRoutes(app: FastifyInstance) {
  app.get("/users/me/preferences", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const [pref] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, auth.user.userId))
      .limit(1);

    if (!pref) {
      return reply.status(404).send({ error: "No preference set" });
    }

    const [emb] = await db
      .select({ id: userPreferenceEmbeddings.id })
      .from(userPreferenceEmbeddings)
      .where(eq(userPreferenceEmbeddings.preferenceId, pref.id))
      .limit(1);

    return reply.send({
      preference: {
        userId: pref.userId,
        preferenceText: pref.preferenceText,
        hasEmbedding: !!emb,
        createdAt: pref.createdAt.toISOString(),
        updatedAt: pref.updatedAt.toISOString()
      }
    });
  });

  app.put("/users/me/preferences", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const parsed = updateUserPreferenceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { preferenceText } = parsed.data;
    const now = new Date();

    const [existing] = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(eq(userPreferences.userId, auth.user.userId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(userPreferences)
        .set({ preferenceText, updatedAt: now })
        .where(eq(userPreferences.userId, auth.user.userId))
        .returning();

      // Invalidate the old embedding so FastAPI re-embeds on the next run.
      await db
        .delete(userPreferenceEmbeddings)
        .where(eq(userPreferenceEmbeddings.preferenceId, existing.id));

      return reply.send({ preference: { userId: updated!.userId, preferenceText: updated!.preferenceText, hasEmbedding: false } });
    }

    const [inserted] = await db
      .insert(userPreferences)
      .values({ userId: auth.user.userId, preferenceText, createdAt: now, updatedAt: now })
      .returning();

    return reply.status(201).send({
      preference: { userId: inserted!.userId, preferenceText: inserted!.preferenceText, hasEmbedding: false }
    });
  });

  app.delete("/users/me/preferences", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const [row] = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(eq(userPreferences.userId, auth.user.userId))
      .limit(1);

    if (!row) {
      return reply.status(404).send({ error: "No preference set" });
    }

    await db.delete(userPreferences).where(eq(userPreferences.id, row.id));
    return reply.status(204).send();
  });
}
