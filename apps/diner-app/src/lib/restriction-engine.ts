import type { RestrictionResponse } from "@digital-menu/shared";
import type { PublicDishIngredient } from "@digital-menu/shared";

export type DishStatus = "safe" | "warn" | "blocked";

/**
 * Determines a dish's safety status based on the user's restrictions.
 * Matches allergy/dislike restrictions by ingredientId against the dish's ingredients.
 * Diet-type restrictions are stored on the profile but not yet matched at dish level
 * (requires per-ingredient diet-compatibility data — deferred to Phase 2).
 */
export function getDishStatus(
  restrictions: RestrictionResponse[],
  dishIngredients: PublicDishIngredient[]
): DishStatus {
  if (restrictions.length === 0) return "safe";

  const ingredientIds = new Set(dishIngredients.map((i) => i.ingredientId));

  let highest: DishStatus = "safe";

  for (const r of restrictions) {
    if (r.restrictionType === "diet" || !r.ingredientId) continue;
    if (!ingredientIds.has(r.ingredientId)) continue;

    if (r.severity === "block") return "blocked";
    if (r.severity === "warn") highest = "warn";
  }

  return highest;
}

export function getMatchingRestrictions(
  restrictions: RestrictionResponse[],
  dishIngredients: PublicDishIngredient[]
): RestrictionResponse[] {
  const ingredientIds = new Set(dishIngredients.map((i) => i.ingredientId));
  return restrictions.filter(
    (r) => r.restrictionType !== "diet" && r.ingredientId && ingredientIds.has(r.ingredientId)
  );
}
