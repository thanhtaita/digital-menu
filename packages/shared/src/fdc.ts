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
  // fdc.food.data_type at match time (e.g. "foundation_food", "sr_legacy_food",
  // "survey_fndds_food") - null for candidates queued before this field existed.
  fdcDataType: z.string().nullable(),
  score: z.number(),
  status: z.enum(["pending", "accepted", "rejected"]),
  createdAt: z.string()
});

export type FdcCandidate = z.infer<typeof fdcCandidateSchema>;

/** One row of fdc.food_nutrient joined to fdc.nutrient - the full panel, not just FDC_NUTRIENT_IDS. */
export const fdcNutrientDetailSchema = z.object({
  name: z.string(),
  unitName: z.string(),
  amount: z.number(),
  rank: z.number().nullable()
});

export type FdcNutrientDetail = z.infer<typeof fdcNutrientDetailSchema>;

/** One row of fdc.food_portion joined to fdc.measure_unit - household/serving-size conversions. */
export const fdcPortionDetailSchema = z.object({
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  portionDescription: z.string().nullable(),
  modifier: z.string().nullable(),
  gramWeight: z.number().nullable()
});

export type FdcPortionDetail = z.infer<typeof fdcPortionDetailSchema>;

/** Full fdc.* record for one fdc_id - used by the candidate-review detail view, not the backfill path. */
export const fdcFullDetailSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string(),
  foodCategory: z.string().nullable(),
  nutrients: z.array(fdcNutrientDetailSchema),
  portions: z.array(fdcPortionDetailSchema)
});

export type FdcFullDetail = z.infer<typeof fdcFullDetailSchema>;
