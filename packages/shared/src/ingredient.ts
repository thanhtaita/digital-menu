import { z } from "zod";
import { imageUrlFieldSchema } from "./image-url";

/** Body for creating a canonical ingredient (global dictionary). Only superadmin may call the API. */
export const createIngredientSchema = z.object({
  canonicalName: z.string().trim().min(1).max(200),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(5000).optional(),
  imageUrl: imageUrlFieldSchema,
  isCommonAllergen: z.boolean().optional(),
  commonAllergenGroup: z.string().max(100).optional()
});

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;

/** Restaurant admin requests a new dictionary entry; remains pending until superadmin approves. */
export const requestIngredientSchema = z.object({
  canonicalName: z.string().trim().min(1).max(200),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(5000).optional(),
  restaurantId: z.number().int().positive()
});

export type RequestIngredientInput = z.infer<typeof requestIngredientSchema>;

/** Superadmin update of an existing dictionary entry. All fields optional. */
export const updateIngredientSchema = z.object({
  canonicalName: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  isCommonAllergen: z.boolean().optional(),
  commonAllergenGroup: z.string().max(100).nullable().optional()
});

export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
