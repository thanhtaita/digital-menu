import { z } from "zod";

/** Single ingredient line on a dish (public diner view). */
export const publicDishIngredientSchema = z.object({
  id: z.number(),
  ingredientId: z.number(),
  canonicalName: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  nutrients: z.record(z.unknown()).nullable().optional(),
  isCommonAllergen: z.boolean(),
  commonAllergenGroup: z.string().nullable(),
  isOptional: z.boolean()
});

export const publicDishSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.string(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  displayOrder: z.number(),
  ingredients: z.array(publicDishIngredientSchema)
});

export const publicSectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayOrder: z.number(),
  dishes: z.array(publicDishSchema)
});

export const publicMenuBlockSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayOrder: z.number(),
  sections: z.array(publicSectionSchema)
});

export const publicRestaurantHeaderSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable()
});

export const publicMenuResponseSchema = z.object({
  restaurant: publicRestaurantHeaderSchema,
  menus: z.array(publicMenuBlockSchema)
});

export type PublicMenuResponse = z.infer<typeof publicMenuResponseSchema>;
export type PublicDishIngredient = z.infer<typeof publicDishIngredientSchema>;
