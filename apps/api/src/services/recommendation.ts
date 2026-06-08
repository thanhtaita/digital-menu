import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { userPreferences, userPreferenceEmbeddings, recommendations } from "@digital-menu/db";

type RecommendationRow = {
  dish_id: number;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  section_id: number;
  restaurant_id: number;
  similarity_score: string;
};

export type GetRecommendationsResult =
  | { status: "no_preference" }
  | { status: "embedding_pending"; preferenceText: string }
  | {
      status: "ok";
      preferenceText: string;
      recommendations: Array<{
        dishId: number;
        name: string;
        description: string | null;
        price: string;
        imageUrl: string | null;
        similarityScore: number;
        rank: number;
        matchedSectionId: number;
        restaurantId: number;
      }>;
    };

export async function getRecommendations(params: {
  userId: number;
  restaurantId?: number;
  limit: number;
}): Promise<GetRecommendationsResult> {
  const { userId, restaurantId, limit } = params;

  const [pref] = await db
    .select({ id: userPreferences.id, preferenceText: userPreferences.preferenceText })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (!pref) return { status: "no_preference" };

  const [embRow] = await db
    .select({ id: userPreferenceEmbeddings.id })
    .from(userPreferenceEmbeddings)
    .where(eq(userPreferenceEmbeddings.preferenceId, pref.id))
    .limit(1);

  if (!embRow) return { status: "embedding_pending", preferenceText: pref.preferenceText };

  const restaurantFilter = restaurantId != null
    ? sql`AND m.restaurant_id = ${restaurantId}`
    : sql``;

  const result = await db.execute<RecommendationRow>(sql`
    SELECT d.id AS dish_id, d.name, d.description, d.price, d.image_url,
           d.section_id, m.restaurant_id,
           1 - (de.embedding <=> upe.embedding) AS similarity_score
    FROM dish_embeddings de
    JOIN dishes d ON d.id = de.dish_id
    JOIN menu_sections ms ON ms.id = d.section_id
    JOIN menus m ON m.id = ms.menu_id
    JOIN user_preference_embeddings upe ON upe.preference_id = ${pref.id}
    WHERE d.is_available = true
      AND m.is_published = true
      ${restaurantFilter}
    ORDER BY de.embedding <=> upe.embedding
    LIMIT ${limit}
  `);

  const ranked = result.rows.map((row: RecommendationRow, idx: number) => ({
    dishId: row.dish_id,
    name: row.name,
    description: row.description,
    price: row.price,
    imageUrl: row.image_url,
    similarityScore: parseFloat(row.similarity_score),
    rank: idx + 1,
    matchedSectionId: row.section_id,
    restaurantId: row.restaurant_id
  }));

  if (ranked.length > 0) {
    await db.insert(recommendations).values(
      ranked.map((r) => ({
        userId,
        dishId: r.dishId,
        similarityScore: r.similarityScore.toFixed(4),
        rank: r.rank
      }))
    );
  }

  return { status: "ok", preferenceText: pref.preferenceText, recommendations: ranked };
}
