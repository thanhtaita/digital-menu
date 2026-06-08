import type { FastifyInstance } from "fastify";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { userFollows, users } from "@digital-menu/db";
import { requireAuth } from "../middleware/auth.js";
import { getSessionIdFromCookie, getSession } from "../lib/auth.js";

const FOLLOW_LIST_PAGE_SIZE = 20;

export async function socialFollowRoutes(app: FastifyInstance) {
  // POST /users/:userId/follow
  app.post<{ Params: { userId: string } }>("/users/:userId/follow", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const targetId = parseInt(request.params.userId, 10);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user id" });
    if (targetId === auth.user.userId) return reply.status(400).send({ error: "Cannot follow yourself" });

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return reply.status(404).send({ error: "User not found" });

    await db
      .insert(userFollows)
      .values({ followerId: auth.user.userId, followingId: targetId })
      .onConflictDoNothing();

    return reply.status(200).send({ ok: true });
  });

  // DELETE /users/:userId/follow
  app.delete<{ Params: { userId: string } }>("/users/:userId/follow", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const targetId = parseInt(request.params.userId, 10);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user id" });

    const [row] = await db
      .select({ id: userFollows.id })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, auth.user.userId), eq(userFollows.followingId, targetId)))
      .limit(1);

    if (!row) return reply.status(404).send({ error: "Not following this user" });

    await db
      .delete(userFollows)
      .where(and(eq(userFollows.followerId, auth.user.userId), eq(userFollows.followingId, targetId)));

    return reply.status(204).send();
  });

  // GET /users/:userId/followers — optional auth, cursor-based
  app.get<{ Params: { userId: string } }>("/users/:userId/followers", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);

    const targetId = parseInt(request.params.userId, 10);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user id" });

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return reply.status(404).send({ error: "User not found" });

    const query = request.query as { before?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || FOLLOW_LIST_PAGE_SIZE, 50);
    const before = query.before ? parseInt(query.before, 10) : null;

    const rows = await db
      .select({
        followId: userFollows.id,
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followerId, users.id))
      .where(
        before !== null && !isNaN(before)
          ? and(eq(userFollows.followingId, targetId), lt(userFollows.id, before))
          : eq(userFollows.followingId, targetId)
      )
      .orderBy(desc(userFollows.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].followId : null;

    return reply.send({
      users: page.map((r) => ({ id: r.id, displayName: r.displayName, avatarUrl: r.avatarUrl })),
      nextCursor
    });
  });

  // GET /users/:userId/following — optional auth, cursor-based
  app.get<{ Params: { userId: string } }>("/users/:userId/following", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);

    const targetId = parseInt(request.params.userId, 10);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user id" });

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return reply.status(404).send({ error: "User not found" });

    const query = request.query as { before?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || FOLLOW_LIST_PAGE_SIZE, 50);
    const before = query.before ? parseInt(query.before, 10) : null;

    const rows = await db
      .select({
        followId: userFollows.id,
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followingId, users.id))
      .where(
        before !== null && !isNaN(before)
          ? and(eq(userFollows.followerId, targetId), lt(userFollows.id, before))
          : eq(userFollows.followerId, targetId)
      )
      .orderBy(desc(userFollows.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].followId : null;

    return reply.send({
      users: page.map((r) => ({ id: r.id, displayName: r.displayName, avatarUrl: r.avatarUrl })),
      nextCursor
    });
  });
}
