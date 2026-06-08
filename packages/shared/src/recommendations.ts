import { z } from "zod";

export const updateUserPreferenceSchema = z.object({
  preferenceText: z.string().min(10).max(2000)
});

export const userPreferenceResponseSchema = z.object({
  userId: z.number(),
  preferenceText: z.string(),
  hasEmbedding: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const recommendationSchema = z.object({
  dishId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.string(),
  imageUrl: z.string().nullable(),
  similarityScore: z.number(),
  rank: z.number(),
  matchedSectionId: z.number(),
  restaurantId: z.number()
});

export const recommendationsResponseSchema = z.object({
  recommendations: z.array(recommendationSchema),
  metadata: z.object({
    basedOn: z.string(),
    generatedAt: z.string(),
    preferenceEmbedded: z.boolean()
  })
});

export const recommendationFeedbackSchema = z.object({
  action: z.enum(["clicked", "selected", "dismissed"])
});

export type UpdateUserPreference = z.infer<typeof updateUserPreferenceSchema>;
export type UserPreferenceResponse = z.infer<typeof userPreferenceResponseSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;
export type RecommendationFeedback = z.infer<typeof recommendationFeedbackSchema>;
