"use client";

import type { PostResponse } from "@digital-menu/shared";
import { PostCard } from "./PostCard";

interface PostGridProps {
  posts: PostResponse[];
  showRestaurant?: boolean;
}

export function PostGrid({ posts, showRestaurant = true }: PostGridProps) {
  if (posts.length === 0) {
    return (
      <p
        style={{
          fontFamily: "var(--ui)",
          fontSize: 14,
          color: "var(--inkFaint)",
          padding: "32px 0",
          textAlign: "center"
        }}
      >
        No posts yet.
      </p>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} showRestaurant={showRestaurant} />
      ))}
    </div>
  );
}
