import { sql } from "drizzle-orm";
import { db } from "../lib/db.js";

/**
 * Below this pg_trgm similarity score a name/description isn't considered a fuzzy match.
 * 0.3 matches Postgres' own default pg_trgm.similarity_threshold.
 */
const SIMILARITY_THRESHOLD = Number(process.env.SEARCH_SIMILARITY_THRESHOLD ?? "0.3");
const RESULT_LIMIT = 20;

export type SearchRestaurantRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
};

export type SearchDishRow = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  restaurant: {
    id: number;
    slug: string;
    name: string;
  };
};

type RestaurantSqlRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
};

type DishSqlRow = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  is_available: boolean;
  restaurant_id: number;
  restaurant_slug: string;
  restaurant_name: string;
};

/**
 * Matches only active restaurants - same visibility rule as GET /public/restaurants
 * (public-menu.ts's eq(restaurants.isActive, true) filter).
 */
async function searchRestaurants(q: string): Promise<SearchRestaurantRow[]> {
  const result = await db.execute<RestaurantSqlRow>(sql`
    SELECT id, name, slug, description, logo_url
    FROM restaurants
    WHERE is_active = true
      AND (
        name ILIKE '%' || ${q} || '%'
        OR description ILIKE '%' || ${q} || '%'
        OR similarity(name, ${q}) > ${SIMILARITY_THRESHOLD}
        OR similarity(coalesce(description, ''), ${q}) > ${SIMILARITY_THRESHOLD}
      )
    ORDER BY greatest(similarity(name, ${q}), similarity(coalesce(description, ''), ${q})) DESC
    LIMIT ${RESULT_LIMIT}
  `);
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    logoUrl: r.logo_url
  }));
}

/**
 * Matches only dishes on a published menu of an active restaurant - same visibility rule as
 * GET /public/restaurants/:slug/menu (public-menu.ts's eq(menus.isPublished, true) +
 * eq(restaurants.isActive, true) filters). Ingredient matches are restricted to non-hidden,
 * approved ingredients, mirroring the ingredient visibility filter used when building the public
 * menu payload.
 */
async function searchDishes(q: string): Promise<SearchDishRow[]> {
  const result = await db.execute<DishSqlRow>(sql`
    SELECT
      d.id, d.name, d.description, d.price, d.image_url, d.is_available,
      r.id AS restaurant_id, r.slug AS restaurant_slug, r.name AS restaurant_name
    FROM dishes d
    JOIN menu_sections ms ON ms.id = d.section_id
    JOIN menus m ON m.id = ms.menu_id AND m.is_published = true
    JOIN restaurants r ON r.id = m.restaurant_id AND r.is_active = true
    WHERE
      d.name ILIKE '%' || ${q} || '%'
      OR d.description ILIKE '%' || ${q} || '%'
      OR similarity(d.name, ${q}) > ${SIMILARITY_THRESHOLD}
      OR similarity(coalesce(d.description, ''), ${q}) > ${SIMILARITY_THRESHOLD}
      OR EXISTS (
        SELECT 1 FROM dish_ingredients di
        JOIN ingredients i ON i.id = di.ingredient_id
        WHERE di.dish_id = d.id
          AND di.is_hidden = false
          AND i.approval_status = 'approved'
          AND (
            i.canonical_name ILIKE '%' || ${q} || '%'
            OR similarity(i.canonical_name, ${q}) > ${SIMILARITY_THRESHOLD}
          )
      )
    ORDER BY greatest(
      similarity(d.name, ${q}),
      similarity(coalesce(d.description, ''), ${q}),
      coalesce((
        SELECT max(similarity(i2.canonical_name, ${q}))
        FROM dish_ingredients di2
        JOIN ingredients i2 ON i2.id = di2.ingredient_id
        WHERE di2.dish_id = d.id AND di2.is_hidden = false AND i2.approval_status = 'approved'
      ), 0)
    ) DESC
    LIMIT ${RESULT_LIMIT}
  `);
  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: String(r.price),
    imageUrl: r.image_url,
    isAvailable: r.is_available,
    restaurant: {
      id: r.restaurant_id,
      slug: r.restaurant_slug,
      name: r.restaurant_name
    }
  }));
}

export async function searchCatalog(rawQuery: string): Promise<{
  restaurants: SearchRestaurantRow[];
  dishes: SearchDishRow[];
}> {
  const q = rawQuery.trim();
  if (q.length < 2) {
    return { restaurants: [], dishes: [] };
  }
  const [restaurants, dishes] = await Promise.all([searchRestaurants(q), searchDishes(q)]);
  return { restaurants, dishes };
}
