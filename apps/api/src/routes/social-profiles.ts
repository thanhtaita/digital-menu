import type { FastifyInstance } from "fastify";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { users, posts, userFollows, restaurants } from "@digital-menu/db";
import { updateProfileSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { getSessionIdFromCookie, getSession } from "../lib/auth.js";
import { saveMultipartImage, mediaStorage } from "../lib/uploads.js";
import { buildPostsResponse, POST_SELECT_COLUMNS, FEED_PAGE_SIZE, type RawPostRow } from "../lib/post-helpers.js";

export async function socialProfileRoutes(app: FastifyInstance) {
  // GET /users/:userId/profile — optional auth
  app.get<{ Params: { userId: string } }>("/users/:userId/profile", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);
    const viewerUserId = session?.userId ?? null;

    const targetId = parseInt(request.params.userId, 10);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user id" });

    const [user] = await db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!user) return reply.status(404).send({ error: "User not found" });

    const [
      [{ followerCount }],
      [{ followingCount }],
      [{ postCount }],
      isFollowedRows
    ] = await Promise.all([
      db
        .select({ followerCount: sql<number>`count(*)::int` })
        .from(userFollows)
        .where(eq(userFollows.followingId, targetId)),
      db
        .select({ followingCount: sql<number>`count(*)::int` })
        .from(userFollows)
        .where(eq(userFollows.followerId, targetId)),
      db
        .select({ postCount: sql<number>`count(*)::int` })
        .from(posts)
        .where(eq(posts.authorId, targetId)),
      viewerUserId !== null && viewerUserId !== targetId
        ? db
            .select({ id: userFollows.id })
            .from(userFollows)
            .where(and(eq(userFollows.followerId, viewerUserId), eq(userFollows.followingId, targetId)))
            .limit(1)
        : Promise.resolve([])
    ]);

    return reply.send({
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followerCount,
      followingCount,
      postCount,
      isFollowedByMe: isFollowedRows.length > 0
    });
  });

  // GET /users/:userId/posts — optional auth, cursor-based
  app.get<{ Params: { userId: string } }>("/users/:userId/posts", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);
    const viewerUserId = session?.userId ?? null;

    const targetId = parseInt(request.params.userId, 10);
    if (isNaN(targetId)) return reply.status(400).send({ error: "Invalid user id" });

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!user) return reply.status(404).send({ error: "User not found" });

    const query = request.query as { before?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || FEED_PAGE_SIZE, 50);
    const before = query.before ? parseInt(query.before, 10) : null;

    const rows = await db
      .select(POST_SELECT_COLUMNS)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .leftJoin(restaurants, eq(posts.restaurantId, restaurants.id))
      .where(
        before !== null && !isNaN(before)
          ? and(eq(posts.authorId, targetId), lt(posts.id, before))
          : eq(posts.authorId, targetId)
      )
      .orderBy(desc(posts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const postsList = await buildPostsResponse(page as RawPostRow[], viewerUserId);
    return reply.send({ posts: postsList, nextCursor });
  });

  // PATCH /users/me/profile — update displayName and bio
  app.patch("/users/me/profile", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const updates: Partial<{ displayName: string | null; bio: string | null }> = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, auth.user.userId))
      .returning({ id: users.id, displayName: users.displayName, bio: users.bio, avatarUrl: users.avatarUrl });

    return reply.send({ user: updated });
  });

  // POST /users/me/avatar — multipart image upload
  app.post("/users/me/avatar", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const file = await request.file();
    const saved = await saveMultipartImage(file, "avatars", mediaStorage);
    if (!saved.ok) return reply.status(saved.status).send({ error: saved.error, code: saved.code });

    await db.update(users).set({ avatarUrl: saved.imageUrl }).where(eq(users.id, auth.user.userId));
    return reply.send({ avatarUrl: saved.imageUrl });
  });
}
