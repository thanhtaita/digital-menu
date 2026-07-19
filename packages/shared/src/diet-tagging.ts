import { z } from "zod";
import { dietTypeEnum } from "./diet-types";

export const dietTagConfidenceEnum = z.enum(["high", "medium", "low"]);
export type DietTagConfidence = z.infer<typeof dietTagConfidenceEnum>;

/** Per-ingredient diet-compatibility map: true = compatible, false = incompatible, missing key = no signal. */
export const ingredientDietTagsSchema = z.record(dietTypeEnum, z.boolean());
export type IngredientDietTags = z.infer<typeof ingredientDietTagsSchema>;

export const dietCandidateSchema = z.object({
  id: z.number(),
  ingredientId: z.number(),
  ingredientCanonicalName: z.string(),
  dietType: dietTypeEnum,
  compatible: z.boolean(),
  confidence: dietTagConfidenceEnum,
  reasoning: z.string().nullable(),
  status: z.enum(["pending", "accepted", "rejected"]),
  createdAt: z.string()
});

export type DietCandidate = z.infer<typeof dietCandidateSchema>;
