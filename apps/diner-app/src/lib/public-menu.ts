import { cache } from "react";
import {
  publicMenuResponseSchema,
  publicRestaurantListResponseSchema,
  type PublicMenuResponse,
  type PublicRestaurantListResponse
} from "@digital-menu/shared";

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";
}

export const fetchPublicMenu = cache(async function fetchPublicMenu(
  slug: string
): Promise<PublicMenuResponse | null> {
  const res = await fetch(`${getApiBase()}/public/restaurants/${encodeURIComponent(slug)}/menu`, {
    next: { revalidate: 60 }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Menu request failed (${res.status})`);
  }
  const json: unknown = await res.json();
  return publicMenuResponseSchema.parse(json);
});

export const fetchPublicRestaurants = cache(async function fetchPublicRestaurants(): Promise<
  PublicRestaurantListResponse["restaurants"]
> {
  const res = await fetch(`${getApiBase()}/public/restaurants`, {
    next: { revalidate: 60 }
  });
  if (!res.ok) {
    throw new Error(`Restaurants request failed (${res.status})`);
  }
  const json: unknown = await res.json();
  const parsed = publicRestaurantListResponseSchema.parse(json);
  return parsed.restaurants;
});
