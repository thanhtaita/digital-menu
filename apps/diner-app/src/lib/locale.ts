import { SOURCE_LOCALE, SUPPORTED_TRANSLATION_LOCALES, type SupportedTranslationLocale } from "@digital-menu/shared";

const SUPPORTED_CODES = new Set<string>(SUPPORTED_TRANSLATION_LOCALES.map((l) => l.code));
const PRIMARY_SUBTAG_TO_CODE = new Map<string, string>(
  SUPPORTED_TRANSLATION_LOCALES.map((l) => [l.code.split("-")[0]!.toLowerCase(), l.code]),
);

export function isKnownLocale(value: string | undefined | null): value is SupportedTranslationLocale {
  return !!value && SUPPORTED_CODES.has(value);
}

/**
 * Best-effort guess from the Accept-Language header, used only to pre-select the language
 * picker's default - never a silent override. The diner can always pick a different language;
 * see captain decision #1 in the i18n-scout-m3 report.
 */
export function inferLocaleFromAcceptLanguage(header: string | null): string | undefined {
  if (!header) return undefined;
  const tags = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim())
    .filter((tag): tag is string => Boolean(tag));

  for (const tag of tags) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (!primary) continue;
    if (primary === SOURCE_LOCALE) return undefined;
    const mapped = PRIMARY_SUBTAG_TO_CODE.get(primary);
    if (mapped) return mapped;
  }
  return undefined;
}
