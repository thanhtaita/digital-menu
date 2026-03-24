import { z } from "zod";

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().max(100).optional(),
  /** When provided, creates a restaurant and sets user as owner + restaurant_admin */
  restaurantName: z.string().min(1).max(200).optional(),
  restaurantSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional()
}).refine(
  (data) => !data.restaurantName || data.restaurantSlug,
  { message: "restaurantSlug required when restaurantName is provided", path: ["restaurantSlug"] }
);

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
