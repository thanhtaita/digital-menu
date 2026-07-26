import { z } from "zod";
import { dietTypeEnum } from "./diet-types.js";

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

export const createRestrictionSchema = z.object({
  restrictionType: restrictionTypeEnum,
  ingredientId: z.number().int().positive().nullable().optional(),
  dietType: dietTypeEnum.optional(),
  severity: restrictionSeverityEnum.default("block")
}).refine(
  (v) => v.restrictionType === "diet" ? !!v.dietType : !!v.ingredientId,
  { message: "ingredientId required for allergy/dislike; dietType required for diet" }
);

export const restrictionResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  restrictionType: restrictionTypeEnum,
  ingredientId: z.number().nullable(),
  dietType: z.string().nullable(),
  severity: restrictionSeverityEnum,
  ingredient: z.object({
    id: z.number(),
    canonicalName: z.string(),
    slug: z.string()
  }).nullable()
});

export const restrictionListResponseSchema = z.object({
  restrictions: z.array(restrictionResponseSchema)
});

export type RestrictionType = z.infer<typeof restrictionTypeEnum>;
export type RestrictionSeverity = z.infer<typeof restrictionSeverityEnum>;
export type UserRestriction = z.infer<typeof userRestrictionSchema>;
export type CreateRestriction = z.infer<typeof createRestrictionSchema>;
export type RestrictionResponse = z.infer<typeof restrictionResponseSchema>;
