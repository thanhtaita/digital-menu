import { cache } from "react";
import type { UserPublicProfile, PostListResponse } from "@digital-menu/shared";

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";
}

export const fetchUserProfile = cache(async function fetchUserProfile(
  userId: number
): Promise<UserPublicProfile | null> {
  const res = await fetch(`${getApiBase()}/users/${userId}/profile`, {
    next: { revalidate: 30 }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Profile request failed (${res.status})`);
  return (await res.json()) as UserPublicProfile;
});

export const fetchUserPosts = cache(async function fetchUserPosts(
  userId: number,
  before?: number
): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  const res = await fetch(`${getApiBase()}/users/${userId}/posts?${params}`, {
    next: { revalidate: 30 }
  });
  if (!res.ok) throw new Error(`User posts request failed (${res.status})`);
  return (await res.json()) as PostListResponse;
});

export const fetchRestaurantPosts = cache(async function fetchRestaurantPosts(
  slug: string,
  before?: number
): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  const res = await fetch(
    `${getApiBase()}/public/restaurants/${encodeURIComponent(slug)}/posts?${params}`,
    { next: { revalidate: 30 } }
  );
  if (res.status === 404) return { posts: [], nextCursor: null };
  if (!res.ok) throw new Error(`Restaurant posts request failed (${res.status})`);
  return (await res.json()) as PostListResponse;
});

// Feed is auth-sensitive — no caching, must forward cookie from server component
export async function fetchFeed(cookieHeader: string, before?: number): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  const res = await fetch(`${getApiBase()}/feed?${params}`, {
    cache: "no-store",
    headers: { Cookie: cookieHeader }
  });
  if (!res.ok) throw new Error(`Feed request failed (${res.status})`);
  return (await res.json()) as PostListResponse;
}
