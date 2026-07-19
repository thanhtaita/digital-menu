import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("../lib/ai/index.js", () => ({
  generateText: vi.fn(),
  requireAiProvider: vi.fn(),
  resolveModel: vi.fn()
}));

import { db } from "../lib/db.js";
import { generateText, requireAiProvider, resolveModel } from "../lib/ai/index.js";
import { proposeDietTags, applyDietTag, AUTO_ACCEPT_CONFIDENCE } from "../services/diet-tagging.js";

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

function updateChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["set", "where"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAiProvider).mockReturnValue("gemini");
  vi.mocked(resolveModel).mockReturnValue("gemini-2.0-flash-lite");
});

describe("AUTO_ACCEPT_CONFIDENCE", () => {
  it("is high", () => {
    expect(AUTO_ACCEPT_CONFIDENCE).toBe("high");
  });
});

describe("proposeDietTags", () => {
  it("parses a valid JSON array response", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { dietType: "vegan", compatible: false, confidence: "high", reasoning: "Dairy product." },
        { dietType: "gluten_free", compatible: true, confidence: "medium", reasoning: "No wheat listed." }
      ]),
      tokensUsed: 42,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await proposeDietTags({ canonicalName: "butter" });
    expect(result).toEqual([
      { dietType: "vegan", compatible: false, confidence: "high", reasoning: "Dairy product." },
      { dietType: "gluten_free", compatible: true, confidence: "medium", reasoning: "No wheat listed." }
    ]);
  });

  it("extracts JSON from a fenced code block", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n[{"dietType":"nut_free","compatible":true,"confidence":"high"}]\n```',
      tokensUsed: 10,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await proposeDietTags({ canonicalName: "rice" });
    expect(result).toEqual([{ dietType: "nut_free", compatible: true, confidence: "high", reasoning: null }]);
  });

  it("drops entries with an unknown diet type or invalid confidence", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify([
        { dietType: "vegan", compatible: true, confidence: "high" },
        { dietType: "not-a-real-diet", compatible: true, confidence: "high" },
        { dietType: "halal", compatible: true, confidence: "extreme" }
      ]),
      tokensUsed: 10,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await proposeDietTags({ canonicalName: "lettuce" });
    expect(result).toEqual([{ dietType: "vegan", compatible: true, confidence: "high", reasoning: null }]);
  });

  it("returns [] when the model response is not valid JSON", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "I cannot determine this.",
      tokensUsed: 5,
      model: "gemini-2.0-flash-lite",
      provider: "gemini"
    });

    const result = await proposeDietTags({ canonicalName: "mystery item" });
    expect(result).toEqual([]);
  });
});

describe("applyDietTag", () => {
  it("merges the new tag into any existing diet_tags and resolves the matching pending candidate", async () => {
    vi.mocked(db.select).mockReturnValue(selectChain([{ dietTags: { halal: true } }]) as never);

    const update = updateChain();
    const updates: unknown[] = [];
    vi.mocked(db.update).mockImplementation(() => {
      updates.push(update);
      return update as never;
    });

    await applyDietTag({ ingredientId: 7, dietType: "vegan", compatible: false });

    expect(update.set).toHaveBeenNthCalledWith(1, { dietTags: { halal: true, vegan: false } });
    expect(update.set).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "accepted" }));
  });

  it("starts from an empty tag map when the ingredient has none yet", async () => {
    vi.mocked(db.select).mockReturnValue(selectChain([{ dietTags: null }]) as never);
    const update = updateChain();
    vi.mocked(db.update).mockReturnValue(update as never);

    await applyDietTag({ ingredientId: 8, dietType: "nut_free", compatible: true });

    expect(update.set).toHaveBeenNthCalledWith(1, { dietTags: { nut_free: true } });
  });
});
