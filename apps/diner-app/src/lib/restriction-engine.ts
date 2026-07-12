import type { RestrictionResponse } from "@digital-menu/shared";
import type { PublicDishIngredient } from "@digital-menu/shared";

export type DishStatus = "safe" | "warn" | "blocked";

/**
 * True if this ingredient is known to violate the given diet type. Missing dietTags, or a missing key
 * for this diet type, means no signal (never treated as a violation) - only an explicit `false` blocks.
 */
function violatesDiet(ingredient: PublicDishIngredient, dietType: string): boolean {
  const compatible = ingredient.dietTags?.[dietType];
  return compatible === false;
}

function dishViolatesDiet(dishIngredients: PublicDishIngredient[], dietType: string): boolean {
  return dishIngredients.some((ing) => violatesDiet(ing, dietType));
}

/**
 * Determines a dish's safety status based on the user's restrictions.
 * Allergy/dislike restrictions match by ingredientId against the dish's ingredients.
 * Diet-type restrictions match by checking each dish ingredient's diet_tags for an explicit
 * incompatibility with the restriction's dietType (see packages/db ingredients.diet_tags).
 */
export function getDishStatus(
  restrictions: RestrictionResponse[],
  dishIngredients: PublicDishIngredient[]
): DishStatus {
  if (restrictions.length === 0) return "safe";

  const ingredientIds = new Set(dishIngredients.map((i) => i.ingredientId));

  let highest: DishStatus = "safe";

  for (const r of restrictions) {
    let matches: boolean;
    if (r.restrictionType === "diet") {
      if (!r.dietType) continue;
      matches = dishViolatesDiet(dishIngredients, r.dietType);
    } else {
      if (!r.ingredientId || !ingredientIds.has(r.ingredientId)) continue;
      matches = true;
    }
    if (!matches) continue;

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
  return restrictions.filter((r) => {
    if (r.restrictionType === "diet") {
      return r.dietType != null && dishViolatesDiet(dishIngredients, r.dietType);
    }
    return r.ingredientId != null && ingredientIds.has(r.ingredientId);
  });
}
