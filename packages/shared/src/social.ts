import { z } from "zod";

// ─── Request schemas ──────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).nullable().optional()
});

export const createPostSchema = z.object({
  content: z.string().min(1).max(2000),
  restaurantId: z.number().int().positive().nullable().optional()
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentCommentId: z.number().int().positive().nullable().optional()
});

// ─── Response schemas ─────────────────────────────────────────────────────────

export const postAuthorSchema = z.object({
  id: z.number(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable()
});

export const postMediaItemSchema = z.object({
  id: z.number(),
  url: z.string(),
  kind: z.enum(["image", "video"]),
  displayOrder: z.number()
});

export const postSchema = z.object({
  id: z.number(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: postAuthorSchema,
  restaurantId: z.number().nullable(),
  restaurantName: z.string().nullable(),
  restaurantSlug: z.string().nullable(),
  media: z.array(postMediaItemSchema),
  likeCount: z.number(),
  commentCount: z.number(),
  likedByMe: z.boolean()
});

export const postListResponseSchema = z.object({
  posts: z.array(postSchema),
  nextCursor: z.number().nullable()
});

export const commentSchema: z.ZodType<CommentResponse> = z.lazy(() =>
  z.object({
    id: z.number(),
    content: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    author: postAuthorSchema,
    parentCommentId: z.number().nullable(),
    replies: z.array(commentSchema)
  })
);

export const commentListResponseSchema = z.object({
  comments: z.array(commentSchema)
});

export const userPublicProfileSchema = z.object({
  id: z.number(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  followerCount: z.number(),
  followingCount: z.number(),
  postCount: z.number(),
  isFollowedByMe: z.boolean()
});

export const followListItemSchema = z.object({
  id: z.number(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable()
});

export const followListResponseSchema = z.object({
  users: z.array(followListItemSchema),
  nextCursor: z.number().nullable()
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type CreatePost = z.infer<typeof createPostSchema>;
export type CreateComment = z.infer<typeof createCommentSchema>;

export type PostAuthor = z.infer<typeof postAuthorSchema>;
export type PostMediaItem = z.infer<typeof postMediaItemSchema>;
export type PostResponse = z.infer<typeof postSchema>;
export type PostListResponse = z.infer<typeof postListResponseSchema>;

// Explicit type for recursive schema
export type CommentResponse = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  parentCommentId: number | null;
  replies: CommentResponse[];
};

export type CommentListResponse = z.infer<typeof commentListResponseSchema>;
export type UserPublicProfile = z.infer<typeof userPublicProfileSchema>;
export type FollowListItem = z.infer<typeof followListItemSchema>;
export type FollowListResponse = z.infer<typeof followListResponseSchema>;
