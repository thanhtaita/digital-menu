import { sql, eq, and } from "drizzle-orm";
import { FDC_NUTRIENT_IDS, type IngredientNutrients } from "@digital-menu/shared";
import { db } from "../lib/db.js";
import { ingredientFdcCandidates, ingredients } from "@digital-menu/db";

/**
 * Below this similarity score a name isn't worth queueing for review at all.
 * Above AUTO_ACCEPT_THRESHOLD, the backfill script sets ingredients.fdc_id directly;
 * between the two thresholds it's queued in ingredient_fdc_candidates for a superadmin.
 */
export const CANDIDATE_THRESHOLD = Number(process.env.FDC_MATCH_CANDIDATE_THRESHOLD ?? "0.35");
export const AUTO_ACCEPT_THRESHOLD = Number(process.env.FDC_MATCH_AUTO_ACCEPT_THRESHOLD ?? "0.7");

export type FdcFoodCandidate = {
  fdcId: number;
  description: string;
  score: number;
};

type FdcFoodRow = { fdc_id: number; description: string; score: number };

/** Fuzzy-match an ingredient's canonical name against fdc.food.description via pg_trgm similarity. */
export async function findFdcCandidates(canonicalName: string, limit = 5): Promise<FdcFoodCandidate[]> {
  const name = canonicalName.trim().toLowerCase();
  if (!name) return [];
  try {
    const result = await db.execute<FdcFoodRow>(sql`
      SELECT fdc_id, description, similarity(description, ${name}) AS score
      FROM fdc.food
      WHERE similarity(description, ${name}) > ${CANDIDATE_THRESHOLD}
      ORDER BY score DESC
      LIMIT ${limit}
    `);
    return result.rows.map((r) => ({ fdcId: r.fdc_id, description: r.description, score: Number(r.score) }));
  } catch {
    // fdc schema not loaded, or pg_trgm unavailable - no candidates, not an error
    return [];
  }
}

type NutrientRow = { nutrient_id: number; amount: string | number };

/** Fetch the fixed macro set (see FDC_NUTRIENT_IDS) for one fdc_id, rounded to 1 decimal. */
export async function fetchFdcNutrients(fdcId: number): Promise<IngredientNutrients> {
  const idsLiteral = Object.values(FDC_NUTRIENT_IDS).join(",");
  const result = await db.execute<NutrientRow>(sql`
    SELECT nutrient_id, amount
    FROM fdc.food_nutrient
    WHERE fdc_id = ${fdcId} AND nutrient_id IN (${sql.raw(idsLiteral)})
  `);
  const byId = new Map(result.rows.map((r) => [r.nutrient_id, Number(r.amount)]));
  const nutrients: IngredientNutrients = {};
  for (const [key, nutrientId] of Object.entries(FDC_NUTRIENT_IDS)) {
    const amount = byId.get(nutrientId);
    if (amount !== undefined) {
      nutrients[key as keyof IngredientNutrients] = Math.round(amount * 10) / 10;
    }
  }
  return nutrients;
}

/** Fetch the human-readable food category for one fdc_id, if any. */
export async function fetchFdcFoodCategory(fdcId: number): Promise<string | null> {
  const result = await db.execute<{ description: string }>(sql`
    SELECT fc.description
    FROM fdc.food f
    JOIN fdc.food_category fc ON fc.id = f.food_category_id
    WHERE f.fdc_id = ${fdcId}
    LIMIT 1
  `);
  return result.rows[0]?.description ?? null;
}

/**
 * Copies nutrients/food category from fdc.* into ingredients (denormalized, no live join at request
 * time), sets ingredients.fdc_id, and resolves the review queue for this ingredient: the matched
 * candidate (if it came from the queue) is marked accepted, any other pending candidates for the
 * same ingredient are marked rejected.
 */
export async function applyFdcMatch(params: {
  ingredientId: number;
  fdcId: number;
}): Promise<void> {
  const { ingredientId, fdcId } = params;
  const [nutrients, foodCategory] = await Promise.all([
    fetchFdcNutrients(fdcId),
    fetchFdcFoodCategory(fdcId)
  ]);

  await db
    .update(ingredients)
    .set({ fdcId, foodCategory, nutrients })
    .where(eq(ingredients.id, ingredientId));

  await db
    .update(ingredientFdcCandidates)
    .set({ status: "accepted", resolvedAt: new Date() })
    .where(and(eq(ingredientFdcCandidates.ingredientId, ingredientId), eq(ingredientFdcCandidates.fdcId, fdcId)));

  await db
    .update(ingredientFdcCandidates)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(
      and(
        eq(ingredientFdcCandidates.ingredientId, ingredientId),
        eq(ingredientFdcCandidates.status, "pending")
      )
    );
}
