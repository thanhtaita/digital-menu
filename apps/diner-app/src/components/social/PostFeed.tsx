"use client";

import { useState } from "react";
import type { PostResponse } from "@digital-menu/shared";
import { PostCard } from "./PostCard";

interface PostFeedProps {
  initialPosts: PostResponse[];
  initialCursor: number | null;
  onLoadMore: (before: number) => Promise<{ posts: PostResponse[]; nextCursor: number | null }>;
  showRestaurant?: boolean;
}

export function PostFeed({ initialPosts, initialCursor, onLoadMore, showRestaurant = true }: PostFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await onLoadMore(cursor);
      setPosts((prev) => [...prev, ...res.posts]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  if (posts.length === 0) {
    return (
      <p
        style={{
          fontFamily: "var(--ui)",
          fontSize: 14,
          color: "var(--inkFaint)",
          padding: "48px 0",
          textAlign: "center"
        }}
      >
        Nothing here yet. Follow some people to see their posts.
      </p>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} showRestaurant={showRestaurant} />
      ))}

      {cursor && (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <button
            onClick={loadMore}
            disabled={loading}
            style={{
              padding: "8px 24px",
              border: "1px solid var(--rule)",
              borderRadius: 999,
              background: "transparent",
              fontFamily: "var(--mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--inkMuted)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
