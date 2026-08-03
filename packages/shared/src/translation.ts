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

/**
 * Fixed allow-list of locales the AI auto-translation system will generate for (report
 * i18n-scout-m3 §7 / captain decision #2). English is the source language and is never in this
 * list - a request for "en" (or no locale) always serves the source-language field directly.
 * The API additionally allows overriding this via TRANSLATION_LOCALES env (comma-separated
 * codes), but this is the default and the single source of truth for the diner-app picker.
 */
export const SUPPORTED_TRANSLATION_LOCALES = [
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" }
] as const;

export type SupportedTranslationLocale = (typeof SUPPORTED_TRANSLATION_LOCALES)[number]["code"];

export const SOURCE_LOCALE = "en";
