import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db.js";
import { posts, postMedia, postLikes, postComments, users, restaurants } from "@digital-menu/db";
import type { PostResponse } from "@digital-menu/shared";

export const FEED_PAGE_SIZE = 20;

export type RawPostRow = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: number;
  restaurantId: number | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  restaurantName: string | null;
  restaurantSlug: string | null;
};

/** Standard column selection for post list queries (requires join to users + left-join to restaurants). */
export const POST_SELECT_COLUMNS = {
  id: posts.id,
  content: posts.content,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  authorId: posts.authorId,
  restaurantId: posts.restaurantId,
  authorDisplayName: users.displayName,
  authorAvatarUrl: users.avatarUrl,
  restaurantName: restaurants.name,
  restaurantSlug: restaurants.slug
} as const;

/** Fetches media, counts, and likedByMe for a set of post rows, then assembles PostResponse[]. */
export async function buildPostsResponse(
  rawPosts: RawPostRow[],
  viewerUserId: number | null
): Promise<PostResponse[]> {
  if (rawPosts.length === 0) return [];

  const postIds = rawPosts.map((p) => p.id);

  const [mediaRows, likeCountRows, commentCountRows, likedRows] = await Promise.all([
    db
      .select()
      .from(postMedia)
      .where(inArray(postMedia.postId, postIds))
      .orderBy(asc(postMedia.displayOrder), asc(postMedia.id)),

    db
      .select({
        postId: postLikes.postId,
        cnt: sql<number>`count(*)::int`
      })
      .from(postLikes)
      .where(inArray(postLikes.postId, postIds))
      .groupBy(postLikes.postId),

    db
      .select({
        postId: postComments.postId,
        cnt: sql<number>`count(*)::int`
      })
      .from(postComments)
      .where(inArray(postComments.postId, postIds))
      .groupBy(postComments.postId),

    viewerUserId !== null
      ? db
          .select({ postId: postLikes.postId })
          .from(postLikes)
          .where(and(inArray(postLikes.postId, postIds), eq(postLikes.userId, viewerUserId)))
      : Promise.resolve([] as { postId: number }[])
  ]);

  const mediaByPost = new Map<number, typeof mediaRows>();
  for (const m of mediaRows) {
    const list = mediaByPost.get(m.postId) ?? [];
    list.push(m);
    mediaByPost.set(m.postId, list);
  }

  const likeCountByPost = new Map<number, number>();
  for (const r of likeCountRows) likeCountByPost.set(r.postId, r.cnt);

  const commentCountByPost = new Map<number, number>();
  for (const r of commentCountRows) commentCountByPost.set(r.postId, r.cnt);

  const likedPostIds = new Set(likedRows.map((r) => r.postId));

  return rawPosts.map((p) => ({
    id: p.id,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    author: {
      id: p.authorId,
      displayName: p.authorDisplayName,
      avatarUrl: p.authorAvatarUrl
    },
    restaurantId: p.restaurantId,
    restaurantName: p.restaurantName,
    restaurantSlug: p.restaurantSlug,
    media: (mediaByPost.get(p.id) ?? []).map((m) => ({
      id: m.id,
      url: m.url,
      kind: m.kind,
      displayOrder: m.displayOrder
    })),
    likeCount: likeCountByPost.get(p.id) ?? 0,
    commentCount: commentCountByPost.get(p.id) ?? 0,
    likedByMe: likedPostIds.has(p.id)
  }));
}
