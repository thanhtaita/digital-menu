import { z } from "zod";

export const suggestIngredientsRequestSchema = z.object({
  dishName: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  contextPrompt: z.string().max(500).optional(),
  cuisineType: z.string().max(100).optional(),
  restaurantId: z.number().int().positive()
});

export type SuggestIngredientsRequest = z.infer<typeof suggestIngredientsRequestSchema>;
