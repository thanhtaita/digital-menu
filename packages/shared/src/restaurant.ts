import { z } from "zod";

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional()
});

export const updateRestaurantSchema = createRestaurantSchema.partial();

export const createMenuSchema = z.object({
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().min(0).optional()
});

export const updateMenuSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isPublished: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional()
});

export const createSectionSchema = z.object({
  name: z.string().min(1).max(200),
  displayOrder: z.number().int().min(0).optional()
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  displayOrder: z.number().int().min(0).optional()
});

export const createDishSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()]),
  imageUrl: z.string().url().optional().or(z.literal("")).optional(),
  isAvailable: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional()
});

export const updateDishSchema = createDishSchema.partial();

export const addDishIngredientSchema = z.object({
  ingredientId: z.number().int().positive(),
  isOptional: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional()
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateDishInput = z.infer<typeof createDishSchema>;
export type UpdateDishInput = z.infer<typeof updateDishSchema>;
export type AddDishIngredientInput = z.infer<typeof addDishIngredientSchema>;
