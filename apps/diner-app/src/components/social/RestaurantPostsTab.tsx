"use client";

import { useState, useEffect } from "react";
import type { PostResponse } from "@digital-menu/shared";
import { apiGetRestaurantPosts } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { PostFeed } from "./PostFeed";
import { PostComposer } from "./PostComposer";

interface RestaurantPostsTabProps {
  slug: string;
  restaurantId?: number;
  restaurantName?: string;
}

export function RestaurantPostsTab({ slug, restaurantId, restaurantName }: RestaurantPostsTabProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    apiGetRestaurantPosts(slug)
      .then((res) => {
        setPosts(res.posts);
        setCursor(res.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  async function loadMore(before: number) {
    const res = await apiGetRestaurantPosts(slug, before);
    return { posts: res.posts, nextCursor: res.nextCursor };
  }

  function handlePosted(post: PostResponse) {
    setPosts((prev) => [post, ...prev]);
    setComposerOpen(false);
  }

  if (loading) {
    return (
      <p style={{ fontFamily: "var(--ui)", fontSize: 14, color: "var(--inkFaint)", padding: "32px 0" }}>
        Loading posts…
      </p>
    );
  }

  return (
    <div>
      {user && (
        <div style={{ marginBottom: 24 }}>
          {composerOpen ? (
            <PostComposer
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              onPosted={handlePosted}
            />
          ) : (
            <button
              onClick={() => setComposerOpen(true)}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid var(--rule)",
                borderRadius: 10,
                background: "transparent",
                fontFamily: "var(--ui)",
                fontSize: 14,
                color: "var(--inkFaint)",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              Write a post about {restaurantName ?? "this restaurant"}…
            </button>
          )}
        </div>
      )}

      <PostFeed
        initialPosts={posts}
        initialCursor={cursor}
        onLoadMore={loadMore}
        showRestaurant={false}
      />
    </div>
  );
}
