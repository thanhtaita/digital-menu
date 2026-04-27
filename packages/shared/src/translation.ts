import { z } from "zod";

/**
 * Locale must be a non-empty BCP-47 tag (e.g. "en", "fr", "vi", "zh-Hant").
 * We enforce a loose format: 2-8 chars, letters, digits, and hyphens.
 */
export const localeSchema = z
  .string()
  .trim()
  .min(2)
  .max(10)
  .regex(/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/, "Invalid BCP-47 locale (e.g. en, fr, zh-Hant)");

/** Create or replace a translation for a single locale. Used for both dishes and ingredients. */
export const upsertTranslationSchema = z.object({
  locale: localeSchema,
  name: z.string().trim().min(1).max(300),
  description: z.string().max(5000).nullable().optional()
});

export type UpsertTranslationInput = z.infer<typeof upsertTranslationSchema>;

/** Shape returned by the API for a single translation row. */
export const translationRowSchema = z.object({
  id: z.number(),
  locale: z.string(),
  name: z.string(),
  description: z.string().nullable().optional()
});

export type TranslationRow = z.infer<typeof translationRowSchema>;
