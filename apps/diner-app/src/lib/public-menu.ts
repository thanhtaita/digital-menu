import { cache } from "react";
import {
  publicMenuResponseSchema,
  publicRestaurantListResponseSchema,
  publicSearchResponseSchema,
  type PublicMenuResponse,
  type PublicRestaurantListResponse,
  type PublicSearchResponse
} from "@digital-menu/shared";

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";
}

export const fetchPublicMenu = cache(async function fetchPublicMenu(
  slug: string,
  locale?: string
): Promise<PublicMenuResponse | null> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const res = await fetch(`${getApiBase()}/public/restaurants/${encodeURIComponent(slug)}/menu${qs}`, {
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

export async function fetchPublicSearch(q: string): Promise<PublicSearchResponse> {
  const res = await fetch(`${getApiBase()}/public/search?q=${encodeURIComponent(q)}`, {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Search request failed (${res.status})`);
  }
  const json: unknown = await res.json();
  return publicSearchResponseSchema.parse(json);
}
