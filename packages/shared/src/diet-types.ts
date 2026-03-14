import { z } from "zod";

export const dietTypeEnum = z.enum([
  "vegan",
  "vegetarian",
  "pescatarian",
  "halal",
  "kosher",
  "gluten_free",
  "dairy_free",
  "nut_free"
]);

export type DietType = z.infer<typeof dietTypeEnum>;

