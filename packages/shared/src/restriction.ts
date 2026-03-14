import { z } from "zod";
import { dietTypeEnum } from "./diet-types";

export const restrictionTypeEnum = z.enum(["allergy", "dislike", "diet"]);

export const restrictionSeverityEnum = z.enum(["block", "warn"]);

export const userRestrictionSchema = z.object({
  id: z.number().int().positive().optional(),
  userId: z.number().int().positive(),
  restrictionType: restrictionTypeEnum,
  ingredientId: z.number().int().positive().nullable().optional(),
  dietType: dietTypeEnum.optional(),
  severity: restrictionSeverityEnum
});

export type RestrictionType = z.infer<typeof restrictionTypeEnum>;
export type RestrictionSeverity = z.infer<typeof restrictionSeverityEnum>;
export type UserRestriction = z.infer<typeof userRestrictionSchema>;

