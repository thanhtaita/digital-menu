import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { posts, userFollows, users, restaurants } from "@digital-menu/db";
import { requireAuth } from "../middleware/auth.js";
import { buildPostsResponse, POST_SELECT_COLUMNS, FEED_PAGE_SIZE, type RawPostRow } from "../lib/post-helpers.js";

export async function socialFeedRoutes(app: FastifyInstance) {
  // GET /feed — chronological posts from followed users + own posts
  app.get("/feed", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const query = request.query as { before?: string; limit?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || FEED_PAGE_SIZE, 50);
    const before = query.before ? parseInt(query.before, 10) : null;

    // Subquery: IDs of users this viewer follows
    const followedIds = db
      .select({ id: userFollows.followingId })
      .from(userFollows)
      .where(eq(userFollows.followerId, auth.user.userId));

    const conditions = [
      or(
        eq(posts.authorId, auth.user.userId),
        inArray(posts.authorId, followedIds)
      )
    ];
    if (before !== null && !isNaN(before)) conditions.push(lt(posts.id, before));

    const rows = await db
      .select(POST_SELECT_COLUMNS)
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .leftJoin(restaurants, eq(posts.restaurantId, restaurants.id))
      .where(and(...conditions))
      .orderBy(desc(posts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const postsList = await buildPostsResponse(page as RawPostRow[], auth.user.userId);
    return reply.send({ posts: postsList, nextCursor });
  });
}
