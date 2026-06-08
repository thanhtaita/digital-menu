import { z } from "zod";

export const sendChatMessageSchema = z.object({
  message: z.string().min(1).max(1000).trim()
});

export const chatRecommendationSchema = z.object({
  dishName: z.string(),
  reason: z.string()
});

export const chatMessageResponseSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string()
});

export const chatResponseSchema = z.object({
  message: z.string(),
  recommendations: z.array(chatRecommendationSchema),
  sessionId: z.number()
});

export const chatHistoryResponseSchema = z.object({
  restaurantName: z.string(),
  messages: z.array(chatMessageResponseSchema),
  summary: z.string().nullable()
});

export type SendChatMessage = z.infer<typeof sendChatMessageSchema>;
export type ChatRecommendation = z.infer<typeof chatRecommendationSchema>;
export type ChatMessageResponse = z.infer<typeof chatMessageResponseSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>;
