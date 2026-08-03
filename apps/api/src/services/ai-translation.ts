import { createHash } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { aiContentTranslations } from "@digital-menu/db";
import { SOURCE_LOCALE, SUPPORTED_TRANSLATION_LOCALES } from "@digital-menu/shared";
import { db } from "../lib/db.js";
import { generateText, resolveModel, isAiConfigured, requireAiProvider } from "../lib/ai/index.js";

/**
 * Locale allow-list gating AI generation on the public, unauthenticated menu read path
 * (i18n-scout-m3 report §7 - a hard abuse-prevention requirement, not optional hardening).
 * Env-overridable via TRANSLATION_LOCALES (comma-separated BCP-47 codes), following the
 * inline-default `process.env` convention used elsewhere in lib/ai/config.ts. Defaults to the
 * captain-approved 11-language list in packages/shared.
 */
const SUPPORTED_LOCALE_SET = new Set<string>(
  process.env.TRANSLATION_LOCALES?.trim()
    ? process.env.TRANSLATION_LOCALES.split(",").map((s) => s.trim()).filter(Boolean)
    : SUPPORTED_TRANSLATION_LOCALES.map((l) => l.code)
);

const GENERATION_TIMEOUT_MS = Number(process.env.AI_TRANSLATION_TIMEOUT_MS ?? "2500");

export function isSupportedTranslationLocale(locale: string | undefined | null): locale is string {
  if (!locale) return false;
  return SUPPORTED_LOCALE_SET.has(locale);
}

function hashSource(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export type EntityType = "dish" | "ingredient";
export type TranslationProvenance = "human" | "ai" | "source";
export type ResolvedField = { value: string; provenance: TranslationProvenance };
export type SourceField = { field: string; text: string | null };
/** Only the two fields the existing manual-translation tables cover (dish/ingredient name+description). */
export type ManualTranslation = { name: string; description: string | null } | null | undefined;

const SYSTEM_PROMPT = `You are a professional menu translator for a restaurant app.

Translate the given fields from English into the target language (a BCP-47 locale code). Keep the tone
concise and appetizing, matching the style of a restaurant menu. Do not transliterate or translate brand
names/proper nouns unless there is a well-established localized form. Preserve the meaning precisely -
this is food/allergen information, not marketing copy to embellish.

Return ONLY a valid JSON object mapping each given field name to its translated string. No markdown, no
explanation, no extra text, no fields other than the ones given.

Example input fields: {"name":"Grilled Salmon","description":"Served with lemon butter sauce."}
Example output (target locale "fr"): {"name":"Saumon grillé","description":"Servi avec une sauce au beurre citronné."}`;

function extractJsonObject(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1]!.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

function buildUserPrompt(locale: string, fields: SourceField[]): string {
  const payload: Record<string, string> = {};
  for (const f of fields) payload[f.field] = f.text ?? "";
  return `Target locale: ${locale}\nFields to translate (JSON): ${JSON.stringify(payload)}`;
}

/** Never lets a slow/hung provider call block the caller past GENERATION_TIMEOUT_MS. */
async function generateWithTimeout(params: { systemPrompt: string; userPrompt: string; model: string }) {
  let timeoutHandle: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("AI translation timed out")), GENERATION_TIMEOUT_MS);
  });
  // If generateText wins the race, the timeout promise is discarded but still eventually
  // rejects - attach a no-op handler so that doesn't surface as an unhandled rejection.
  timeoutPromise.catch(() => {});
  try {
    return await Promise.race([
      generateText({ systemPrompt: params.systemPrompt, userPrompt: params.userPrompt, model: params.model, temperature: 0.2 }),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

async function upsertCache(params: {
  entityType: EntityType;
  entityId: number;
  locale: string;
  model: string;
  entries: { field: string; sourceHash: string; translatedValue: string }[];
}): Promise<void> {
  if (params.entries.length === 0) return;
  await db
    .insert(aiContentTranslations)
    .values(
      params.entries.map((e) => ({
        entityType: params.entityType,
        entityId: params.entityId,
        field: e.field,
        locale: params.locale,
        sourceHash: e.sourceHash,
        translatedValue: e.translatedValue,
        model: params.model
      }))
    )
    .onConflictDoUpdate({
      target: [
        aiContentTranslations.entityType,
        aiContentTranslations.entityId,
        aiContentTranslations.field,
        aiContentTranslations.locale
      ],
      set: {
        sourceHash: sql`excluded.source_hash`,
        translatedValue: sql`excluded.translated_value`,
        model: sql`excluded.model`,
        generatedAt: sql`now()`
      }
    });
}

function manualFieldValue(manual: ManualTranslation, field: string): string | null | undefined {
  if (!manual) return undefined;
  if (field === "name") return manual.name;
  if (field === "description") return manual.description;
  return undefined;
}

/**
 * Resolves translated values for one entity's fields in one locale, per i18n-scout-m3 report §4:
 * 1. A human row in dish_translations/ingredient_translations wins unconditionally (no hash check).
 * 2. Otherwise the AI cache table is checked by (entityType, entityId, field, locale, sourceHash) -
 *    a hash match is a cache hit; a miss triggers synchronous generation with a short timeout,
 *    upserting the cache on success.
 * 3. Any timeout/error/malformed output/unsupported-locale falls back to the source text for that
 *    request only - never a written failure marker (self-healing on the next request).
 * Never chains translations - always regenerates from the source-language field passed in `fields`.
 */
export async function resolveEntityTranslations(params: {
  entityType: EntityType;
  entityId: number;
  locale: string | undefined | null;
  fields: SourceField[];
  manualTranslation?: ManualTranslation;
}): Promise<Record<string, ResolvedField>> {
  const { entityType, entityId, locale, fields, manualTranslation } = params;
  const result: Record<string, ResolvedField> = {};

  if (!locale || locale === SOURCE_LOCALE || !isSupportedTranslationLocale(locale)) {
    for (const f of fields) result[f.field] = { value: f.text ?? "", provenance: "source" };
    return result;
  }

  const fieldsNeedingAi: SourceField[] = [];
  for (const f of fields) {
    const manualValue = manualFieldValue(manualTranslation, f.field);
    if (manualValue !== undefined && manualValue !== null) {
      result[f.field] = { value: manualValue, provenance: "human" };
      continue;
    }
    if (!f.text || !f.text.trim()) {
      result[f.field] = { value: f.text ?? "", provenance: "source" };
      continue;
    }
    fieldsNeedingAi.push(f);
  }

  if (fieldsNeedingAi.length === 0 || !isAiConfigured()) {
    for (const f of fieldsNeedingAi) result[f.field] = { value: f.text ?? "", provenance: "source" };
    return result;
  }

  let toGenerate: (SourceField & { hash: string })[] = [];
  try {
    const cacheRows = await db
      .select()
      .from(aiContentTranslations)
      .where(
        and(
          eq(aiContentTranslations.entityType, entityType),
          eq(aiContentTranslations.entityId, entityId),
          eq(aiContentTranslations.locale, locale),
          inArray(
            aiContentTranslations.field,
            fieldsNeedingAi.map((f) => f.field)
          )
        )
      );
    const cacheByField = new Map(cacheRows.map((r) => [r.field, r]));

    for (const f of fieldsNeedingAi) {
      const hash = hashSource(f.text!);
      const cached = cacheByField.get(f.field);
      if (cached && cached.sourceHash === hash) {
        result[f.field] = { value: cached.translatedValue, provenance: "ai" };
      } else {
        toGenerate.push({ ...f, hash });
      }
    }
  } catch {
    // Cache lookup failed (e.g. DB hiccup) - treat every field as needing (re)generation below.
    toGenerate = fieldsNeedingAi.map((f) => ({ ...f, hash: hashSource(f.text!) }));
  }

  if (toGenerate.length === 0) return result;

  try {
    const provider = requireAiProvider();
    const model = resolveModel(provider, "translate", process.env.AI_TRANSLATION_MODEL);
    const aiResult = await generateWithTimeout({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(locale, toGenerate),
      model
    });

    let parsed: Record<string, unknown> = {};
    try {
      const obj = JSON.parse(extractJsonObject(aiResult.text));
      if (obj && typeof obj === "object" && !Array.isArray(obj)) parsed = obj as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const cacheEntries: { field: string; sourceHash: string; translatedValue: string }[] = [];
    for (const f of toGenerate) {
      const value = parsed[f.field];
      if (typeof value === "string" && value.trim()) {
        result[f.field] = { value, provenance: "ai" };
        cacheEntries.push({ field: f.field, sourceHash: f.hash, translatedValue: value });
      } else {
        result[f.field] = { value: f.text ?? "", provenance: "source" };
      }
    }

    if (cacheEntries.length > 0) {
      // A cache-write failure must not blank out translations that already succeeded this
      // request - it just means the same generation happens again on the next cache miss.
      try {
        await upsertCache({ entityType, entityId, locale, model: aiResult.model, entries: cacheEntries });
      } catch {
        // swallow - self-healing on next request, per report §7
      }
    }
  } catch {
    for (const f of toGenerate) result[f.field] = { value: f.text ?? "", provenance: "source" };
  }

  return result;
}
