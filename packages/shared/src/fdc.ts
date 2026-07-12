import { z } from "zod";

/**
 * Fixed set of USDA FoodData Central nutrient IDs denormalized into ingredients.nutrients.
 * Deliberately narrow ("whatever fdc has" is not the goal) - extend by adding a key here,
 * not by reading arbitrary nutrient_ids at request time.
 */
export const FDC_NUTRIENT_IDS = {
  cal: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  sodium: 1093
} as const;

export type FdcNutrientKey = keyof typeof FDC_NUTRIENT_IDS;

export const ingredientNutrientsSchema = z
  .object({
    cal: z.number().optional(),
    protein: z.number().optional(),
    fat: z.number().optional(),
    carbs: z.number().optional(),
    sodium: z.number().optional()
  })
  .partial();

export type IngredientNutrients = z.infer<typeof ingredientNutrientsSchema>;

export const fdcCandidateSchema = z.object({
  id: z.number(),
  ingredientId: z.number(),
  ingredientCanonicalName: z.string(),
  fdcId: z.number(),
  fdcDescription: z.string(),
  score: z.number(),
  status: z.enum(["pending", "accepted", "rejected"]),
  createdAt: z.string()
});

export type FdcCandidate = z.infer<typeof fdcCandidateSchema>;
