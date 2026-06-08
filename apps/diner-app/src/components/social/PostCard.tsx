"use client";

import { useState } from "react";
import Link from "next/link";
import type { PostResponse } from "@digital-menu/shared";
import { AvatarOrGradient } from "./AvatarOrGradient";
import { apiLikePost, apiUnlikePost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface PostCardProps {
  post: PostResponse;
  showRestaurant?: boolean;
}

export function PostCard({ post, showRestaurant = true }: PostCardProps) {
  const { user } = useAuth();
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);

  const authorName = post.author.displayName ?? `User ${post.author.id}`;
  const dateStr = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  async function toggleLike() {
    if (!user || likeBusy) return;
    setLikeBusy(true);
    try {
      if (likedByMe) {
        const res = await apiUnlikePost(post.id);
        setLikedByMe(false);
        setLikeCount(res.likeCount);
      } else {
        const res = await apiLikePost(post.id);
        setLikedByMe(true);
        setLikeCount(res.likeCount);
      }
    } finally {
      setLikeBusy(false);
    }
  }

  const firstImage = post.media.find((m) => m.kind === "image");

  return (
    <article
      style={{
        borderBottom: "1px solid var(--rule)",
        padding: "20px 0"
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Link href={`/u/${post.author.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
          <AvatarOrGradient avatarUrl={post.author.avatarUrl} seed={authorName} size={36} />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <Link
              href={`/u/${post.author.id}`}
              style={{
                fontFamily: "var(--ui)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ink)",
                textDecoration: "none"
              }}
            >
              {authorName}
            </Link>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--inkFaint)" }}>
              {dateStr}
            </span>
            {showRestaurant && post.restaurantName && post.restaurantSlug && (
              <Link
                href={`/r/${post.restaurantSlug}`}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                @ {post.restaurantName}
              </Link>
            )}
          </div>

          <p
            style={{
              fontFamily: "var(--ui)",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--ink)",
              margin: "6px 0 0"
            }}
          >
            {post.content}
          </p>

          {firstImage && (
            <Link href={`/posts/${post.id}`} style={{ display: "block", marginTop: 10 }}>
              <img
                src={firstImage.url}
                alt=""
                style={{
                  width: "100%",
                  maxWidth: 480,
                  borderRadius: 8,
                  objectFit: "cover",
                  maxHeight: 320,
                  display: "block"
                }}
              />
            </Link>
          )}

          <div style={{ display: "flex", gap: 16, marginTop: 10, alignItems: "center" }}>
            <button
              onClick={toggleLike}
              disabled={!user || likeBusy}
              style={{
                all: "unset",
                cursor: user ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: likedByMe ? "var(--accent)" : "var(--inkFaint)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: likeBusy ? 0.5 : 1,
                transition: "opacity 0.15s, color 0.15s"
              }}
            >
              ♥ {likeCount}
            </button>

            <Link
              href={`/posts/${post.id}`}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--inkFaint)",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.08em"
              }}
            >
              ◯ {post.commentCount}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
