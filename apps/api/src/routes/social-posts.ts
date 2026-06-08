import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { posts, postMedia, postLikes, postComments, users, restaurants } from "@digital-menu/db";
import { createPostSchema, createCommentSchema } from "@digital-menu/shared";
import { requireAuth } from "../middleware/auth.js";
import { getSessionIdFromCookie, getSession } from "../lib/auth.js";
import { saveMultipartMedia, localMediaStorage } from "../lib/uploads.js";
import { buildPostsResponse, POST_SELECT_COLUMNS, FEED_PAGE_SIZE, type RawPostRow } from "../lib/post-helpers.js";

export async function socialPostRoutes(app: FastifyInstance) {
  // POST /posts — create a post
  app.post("/posts", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { content, restaurantId } = parsed.data;

    if (restaurantId != null) {
      const [rest] = await db
        .select({ id: restaurants.id })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
      if (!rest) return reply.status(404).send({ error: "Restaurant not found" });
    }

    const [inserted] = await db
      .insert(posts)
      .values({
        authorId: auth.user.userId,
        restaurantId: restaurantId ?? null,
        content
      })
      .returning();

    if (!inserted) return reply.status(500).send({ error: "Failed to create post" });

    const [raw] = await db
      .select(POST_SELECT_COLUMNS)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .leftJoin(restaurants, eq(posts.restaurantId, restaurants.id))
      .where(eq(posts.id, inserted.id))
      .limit(1);

    const [postResponse] = await buildPostsResponse([raw as RawPostRow], auth.user.userId);
    return reply.status(201).send({ post: postResponse });
  });

  // GET /posts — list posts (public, optional auth)
  app.get("/posts", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);
    const viewerUserId = session?.userId ?? null;

    const query = request.query as {
      restaurantId?: string;
      authorId?: string;
      before?: string;
      limit?: string;
    };

    const limit = Math.min(parseInt(query.limit ?? "20", 10) || FEED_PAGE_SIZE, 50);
    const before = query.before ? parseInt(query.before, 10) : null;
    const restaurantId = query.restaurantId ? parseInt(query.restaurantId, 10) : null;
    const authorId = query.authorId ? parseInt(query.authorId, 10) : null;

    const conditions = [];
    if (before !== null && !isNaN(before)) conditions.push(lt(posts.id, before));
    if (restaurantId !== null && !isNaN(restaurantId)) conditions.push(eq(posts.restaurantId, restaurantId));
    if (authorId !== null && !isNaN(authorId)) conditions.push(eq(posts.authorId, authorId));

    const rows = await db
      .select(POST_SELECT_COLUMNS)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .leftJoin(restaurants, eq(posts.restaurantId, restaurants.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(posts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const postsList = await buildPostsResponse(page as RawPostRow[], viewerUserId);
    return reply.send({ posts: postsList, nextCursor });
  });

  // GET /posts/:postId — single post (optional auth)
  app.get<{ Params: { postId: string } }>("/posts/:postId", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);
    const viewerUserId = session?.userId ?? null;

    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    const [raw] = await db
      .select(POST_SELECT_COLUMNS)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .leftJoin(restaurants, eq(posts.restaurantId, restaurants.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (!raw) return reply.status(404).send({ error: "Post not found" });

    const [postResponse] = await buildPostsResponse([raw as RawPostRow], viewerUserId);
    return reply.send({ post: postResponse });
  });

  // DELETE /posts/:postId — author only
  app.delete<{ Params: { postId: string } }>("/posts/:postId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    const [post] = await db.select({ id: posts.id, authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return reply.status(404).send({ error: "Post not found" });
    if (post.authorId !== auth.user.userId) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });

    await db.delete(posts).where(eq(posts.id, postId));
    return reply.status(204).send();
  });

  // POST /posts/:postId/like — idempotent
  app.post<{ Params: { postId: string } }>("/posts/:postId/like", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return reply.status(404).send({ error: "Post not found" });

    await db
      .insert(postLikes)
      .values({ postId, userId: auth.user.userId })
      .onConflictDoNothing();

    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(postLikes)
      .where(eq(postLikes.postId, postId));

    return reply.send({ likeCount: cnt });
  });

  // DELETE /posts/:postId/like
  app.delete<{ Params: { postId: string } }>("/posts/:postId/like", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    await db.delete(postLikes).where(and(eq(postLikes.postId, postId), eq(postLikes.userId, auth.user.userId)));

    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(postLikes)
      .where(eq(postLikes.postId, postId));

    return reply.send({ likeCount: cnt });
  });

  // GET /posts/:postId/comments — optional auth
  app.get<{ Params: { postId: string } }>("/posts/:postId/comments", async (request, reply) => {
    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return reply.status(404).send({ error: "Post not found" });

    const commentRows = await db
      .select({
        id: postComments.id,
        content: postComments.content,
        createdAt: postComments.createdAt,
        updatedAt: postComments.updatedAt,
        parentCommentId: postComments.parentCommentId,
        authorId: users.id,
        authorDisplayName: users.displayName,
        authorAvatarUrl: users.avatarUrl
      })
      .from(postComments)
      .innerJoin(users, eq(postComments.authorId, users.id))
      .where(eq(postComments.postId, postId))
      .orderBy(asc(postComments.createdAt), asc(postComments.id));

    // Nest one level deep
    const topLevel = [];
    const byParent = new Map<number, typeof commentRows>();
    for (const c of commentRows) {
      if (c.parentCommentId === null) {
        topLevel.push(c);
      } else {
        const list = byParent.get(c.parentCommentId) ?? [];
        list.push(c);
        byParent.set(c.parentCommentId, list);
      }
    }

    const comments = topLevel.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      author: { id: c.authorId, displayName: c.authorDisplayName, avatarUrl: c.authorAvatarUrl },
      parentCommentId: c.parentCommentId,
      replies: (byParent.get(c.id) ?? []).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        author: { id: r.authorId, displayName: r.authorDisplayName, avatarUrl: r.authorAvatarUrl },
        parentCommentId: r.parentCommentId,
        replies: []
      }))
    }));

    return reply.send({ comments });
  });

  // POST /posts/:postId/comments
  app.post<{ Params: { postId: string } }>("/posts/:postId/comments", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post) return reply.status(404).send({ error: "Post not found" });

    const parsed = createCommentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { content, parentCommentId } = parsed.data;

    if (parentCommentId != null) {
      const [parent] = await db
        .select({ id: postComments.id, postId: postComments.postId })
        .from(postComments)
        .where(eq(postComments.id, parentCommentId))
        .limit(1);
      if (!parent || parent.postId !== postId) {
        return reply.status(404).send({ error: "Parent comment not found" });
      }
    }

    const [inserted] = await db
      .insert(postComments)
      .values({
        postId,
        authorId: auth.user.userId,
        content,
        parentCommentId: parentCommentId ?? null
      })
      .returning();

    if (!inserted) return reply.status(500).send({ error: "Failed to create comment" });

    const [author] = await db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, auth.user.userId))
      .limit(1);

    return reply.status(201).send({
      comment: {
        id: inserted.id,
        content: inserted.content,
        createdAt: inserted.createdAt.toISOString(),
        updatedAt: inserted.updatedAt.toISOString(),
        author: { id: author!.id, displayName: author!.displayName, avatarUrl: author!.avatarUrl },
        parentCommentId: inserted.parentCommentId,
        replies: []
      }
    });
  });

  // DELETE /posts/:postId/comments/:commentId — author only
  app.delete<{ Params: { postId: string; commentId: string } }>(
    "/posts/:postId/comments/:commentId",
    async (request, reply) => {
      const auth = await requireAuth(request, reply);
      if (!auth) return;

      const postId = parseInt(request.params.postId, 10);
      const commentId = parseInt(request.params.commentId, 10);
      if (isNaN(postId) || isNaN(commentId)) return reply.status(400).send({ error: "Invalid id" });

      const [comment] = await db
        .select({ id: postComments.id, authorId: postComments.authorId, postId: postComments.postId })
        .from(postComments)
        .where(eq(postComments.id, commentId))
        .limit(1);

      if (!comment || comment.postId !== postId) return reply.status(404).send({ error: "Comment not found" });
      if (comment.authorId !== auth.user.userId) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });

      await db.delete(postComments).where(eq(postComments.id, commentId));
      return reply.status(204).send();
    }
  );

  // POST /posts/:postId/media — multipart upload
  app.post<{ Params: { postId: string } }>("/posts/:postId/media", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const postId = parseInt(request.params.postId, 10);
    if (isNaN(postId)) return reply.status(400).send({ error: "Invalid post id" });

    const [post] = await db
      .select({ id: posts.id, authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) return reply.status(404).send({ error: "Post not found" });
    if (post.authorId !== auth.user.userId) return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });

    const file = await request.file();
    const saved = await saveMultipartMedia(file, "posts", localMediaStorage);
    if (!saved.ok) return reply.status(saved.status).send({ error: saved.error, code: saved.code });

    const currentMedia = await db
      .select({ displayOrder: postMedia.displayOrder })
      .from(postMedia)
      .where(eq(postMedia.postId, postId))
      .orderBy(desc(postMedia.displayOrder))
      .limit(1);

    const nextOrder = currentMedia.length > 0 ? currentMedia[0].displayOrder + 1 : 0;

    const [inserted] = await db
      .insert(postMedia)
      .values({ postId, url: saved.url, kind: saved.kind, displayOrder: nextOrder })
      .returning();

    const allMedia = await db
      .select()
      .from(postMedia)
      .where(eq(postMedia.postId, postId))
      .orderBy(asc(postMedia.displayOrder), asc(postMedia.id));

    return reply.status(201).send({
      media: allMedia.map((m) => ({ id: m.id, url: m.url, kind: m.kind, displayOrder: m.displayOrder }))
    });
  });
}
