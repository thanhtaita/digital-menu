import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn()
  }
}));

vi.mock("../lib/ai/index.js", () => ({
  generateText: vi.fn(),
  requireAiProvider: vi.fn(),
  resolveModel: vi.fn(),
  isAiConfigured: vi.fn()
}));

import { db } from "../lib/db.js";
import { generateText, requireAiProvider, resolveModel, isAiConfigured } from "../lib/ai/index.js";
import { resolveEntityTranslations, isSupportedTranslationLocale } from "../services/ai-translation.js";

function selectChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(data).then(res, rej),
    configurable: true
  });
  return chain;
}

function insertChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["values", "onConflictDoUpdate"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(undefined).then(res, rej),
    configurable: true
  });
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAiProvider).mockReturnValue("gemini");
  vi.mocked(resolveModel).mockReturnValue("gemini-2.0-flash-lite");
  vi.mocked(isAiConfigured).mockReturnValue(true);
  vi.mocked(db.select).mockReturnValue(selectChain([]) as never);
  vi.mocked(db.insert).mockReturnValue(insertChain() as never);
  vi.mocked(generateText).mockResolvedValue({
    text: JSON.stringify({ name: "Saumon grillé", description: "Servi avec une sauce au beurre citronné." }),
    tokensUsed: 20,
    model: "gemini-2.0-flash-lite",
    provider: "gemini"
  });
});

describe("isSupportedTranslationLocale", () => {
  it("accepts locales from the default allow-list", () => {
    expect(isSupportedTranslationLocale("es")).toBe(true);
    expect(isSupportedTranslationLocale("vi")).toBe(true);
    expect(isSupportedTranslationLocale("zh-Hans")).toBe(true);
  });

  it("rejects locales not on the allow-list, including the source locale", () => {
    expect(isSupportedTranslationLocale("xx")).toBe(false);
    expect(isSupportedTranslationLocale("en")).toBe(false);
    expect(isSupportedTranslationLocale(undefined)).toBe(false);
    expect(isSupportedTranslationLocale(null)).toBe(false);
  });
});

describe("resolveEntityTranslations", () => {
  const fields = [
    { field: "name", text: "Grilled Salmon" },
    { field: "description", text: "Served with lemon butter." }
  ];

  it("serves the source text unchanged when no locale is requested", async () => {
    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: undefined, fields });
    expect(result.name).toEqual({ value: "Grilled Salmon", provenance: "source" });
    expect(result.description).toEqual({ value: "Served with lemon butter.", provenance: "source" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("serves the source text for the source locale (en)", async () => {
    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: "en", fields });
    expect(result.name.provenance).toBe("source");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("falls back to source silently for a locale not on the allow-list (abuse prevention)", async () => {
    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: "xx-YY", fields });
    expect(result.name).toEqual({ value: "Grilled Salmon", provenance: "source" });
    expect(db.select).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("prefers a manual translation over the AI cache, unconditionally", async () => {
    const result = await resolveEntityTranslations({
      entityType: "dish",
      entityId: 1,
      locale: "fr",
      fields,
      manualTranslation: { name: "Saumon grillé", description: null }
    });
    expect(result.name).toEqual({ value: "Saumon grillé", provenance: "human" });
    // description has no manual override (null) -> falls through to the AI path
    expect(db.select).toHaveBeenCalled();
  });

  it("serves a cached AI translation when the source hash matches, without calling generateText", async () => {
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update("Grilled Salmon", "utf8").digest("hex");
    vi.mocked(db.select).mockReturnValue(
      selectChain([{ field: "name", sourceHash: hash, translatedValue: "Saumon grillé" }]) as never
    );

    const result = await resolveEntityTranslations({
      entityType: "dish",
      entityId: 1,
      locale: "fr",
      fields: [{ field: "name", text: "Grilled Salmon" }]
    });

    expect(result.name).toEqual({ value: "Saumon grillé", provenance: "ai" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("regenerates on a cache miss (stale hash), upserts the cache, and returns the new value", async () => {
    vi.mocked(db.select).mockReturnValue(
      selectChain([{ field: "name", sourceHash: "stale-hash", translatedValue: "Old translation" }]) as never
    );
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ name: "Saumon grillé" }),
      tokensUsed: 20,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await resolveEntityTranslations({
      entityType: "dish",
      entityId: 1,
      locale: "fr",
      fields: [{ field: "name", text: "Grilled Salmon" }]
    });

    expect(result.name).toEqual({ value: "Saumon grillé", provenance: "ai" });
    expect(db.insert).toHaveBeenCalled();
  });

  it("falls back per-field to source when the model output is missing a field, without blanking a good one", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ name: "Saumon grillé" }), // description omitted
      tokensUsed: 20,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: "fr", fields });

    expect(result.name).toEqual({ value: "Saumon grillé", provenance: "ai" });
    expect(result.description).toEqual({ value: "Served with lemon butter.", provenance: "source" });
  });

  it("falls back to source for every field when the model output is not valid JSON", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Sorry, I cannot help with that.",
      tokensUsed: 5,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: "fr", fields });

    expect(result.name).toEqual({ value: "Grilled Salmon", provenance: "source" });
    expect(result.description).toEqual({ value: "Served with lemon butter.", provenance: "source" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("falls back to source for every field when generateText throws (timeout/provider error)", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("AI translation timed out"));

    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: "fr", fields });

    expect(result.name).toEqual({ value: "Grilled Salmon", provenance: "source" });
    expect(result.description).toEqual({ value: "Served with lemon butter.", provenance: "source" });
  });

  it("skips the AI path entirely (no cache lookup) when no provider is configured", async () => {
    vi.mocked(isAiConfigured).mockReturnValue(false);

    const result = await resolveEntityTranslations({ entityType: "dish", entityId: 1, locale: "fr", fields });

    expect(result.name).toEqual({ value: "Grilled Salmon", provenance: "source" });
    expect(db.select).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("never translates a null/empty field - keeps it as source with no AI call for that field", async () => {
    const result = await resolveEntityTranslations({
      entityType: "ingredient",
      entityId: 2,
      locale: "fr",
      fields: [
        { field: "name", text: "Peanut" },
        { field: "description", text: null }
      ]
    });

    expect(result.description).toEqual({ value: "", provenance: "source" });
  });
});
