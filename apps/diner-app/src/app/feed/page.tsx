"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PostResponse } from "@digital-menu/shared";
import { useAuth } from "@/lib/auth-context";
import { apiGetFeed } from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";
import { PostFeed } from "@/components/social/PostFeed";

export default function FeedPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiGetFeed()
      .then((res) => {
        setPosts(res.posts);
        setCursor(res.nextCursor);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  async function loadMore(before: number) {
    const res = await apiGetFeed(before);
    return { posts: res.posts, nextCursor: res.nextCursor };
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <SiteHeader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[640px] px-6 py-8">
        <h1
          style={{
            fontFamily: "var(--display)",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--ink)",
            margin: "0 0 24px",
            letterSpacing: -0.5
          }}
        >
          Your feed
        </h1>

        {fetching ? (
          <p style={{ fontFamily: "var(--ui)", fontSize: 14, color: "var(--inkFaint)" }}>Loading…</p>
        ) : (
          <PostFeed initialPosts={posts} initialCursor={cursor} onLoadMore={loadMore} showRestaurant />
        )}
      </main>
    </div>
  );
}
