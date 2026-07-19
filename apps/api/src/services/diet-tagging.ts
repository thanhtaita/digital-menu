import { and, eq } from "drizzle-orm";
import { dietTypeEnum, type DietTagConfidence, type DietType } from "@digital-menu/shared";
import { generateText, resolveModel, requireAiProvider } from "../lib/ai/index.js";
import { db } from "../lib/db.js";
import { ingredientDietCandidates, ingredients } from "@digital-menu/db";

const DIET_TYPES = dietTypeEnum.options;

/** Diet tags at or above this confidence are applied to ingredients.diet_tags without human review. */
export const AUTO_ACCEPT_CONFIDENCE: DietTagConfidence = "high";

const SYSTEM_PROMPT = `You are a culinary and dietary-compliance expert helping tag a global ingredient dictionary.

Given a single ingredient's canonical name (and optional description), judge its compatibility with each of
these diet types: ${DIET_TYPES.join(", ")}.

- vegan/vegetarian/pescatarian: judge by animal-product content (vegan excludes all animal products including
  dairy/honey/eggs; vegetarian allows dairy/eggs; pescatarian allows fish/seafood in addition to vegetarian).
- halal/kosher: judge by religious dietary law (e.g. pork and alcohol are never halal/kosher; land animals
  need ritual slaughter which you cannot verify from a name alone - treat those as low confidence).
- gluten_free: judge by wheat/barley/rye/gluten content.
- dairy_free: judge by milk-derived content.
- nut_free: judge by tree nut or peanut content.

Only include diet types where you have a real opinion - omit ones that are genuinely ambiguous for this
ingredient (e.g. "broth" without knowing the base). For included diet types, rate your confidence honestly:
"high" only when the answer is unambiguous from the name/description alone, "low" when it depends on
preparation/sourcing details you cannot know, "medium" otherwise.

Return ONLY a valid JSON array. No markdown, no explanation, no extra text.
Each element must have:
- dietType: one of ${DIET_TYPES.map((d) => `"${d}"`).join(", ")}
- compatible: true if the ingredient is compatible with that diet, false if it violates it
- confidence: "high" | "medium" | "low"
- reasoning: one short sentence

Example:
[{"dietType":"vegan","compatible":false,"confidence":"high","reasoning":"Dairy product, not plant-based."},{"dietType":"gluten_free","compatible":true,"confidence":"high","reasoning":"No wheat/barley/rye content."}]`;

type DietTagRaw = {
  dietType: string;
  compatible: unknown;
  confidence: string;
  reasoning?: string;
};

export type DietTagProposal = {
  dietType: DietType;
  compatible: boolean;
  confidence: DietTagConfidence;
  reasoning: string | null;
};

function buildPrompt(params: { canonicalName: string; description?: string | null }): string {
  const lines = [`Ingredient: "${params.canonicalName}"`];
  if (params.description) lines.push(`Description: "${params.description}"`);
  return lines.join("\n");
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1]!.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

const VALID_DIET_TYPES = new Set<string>(DIET_TYPES);
const VALID_CONFIDENCES = new Set<string>(["high", "medium", "low"]);

/** LLM-assisted diet-compatibility judgment for one ingredient, across all diet types it has an opinion on. */
export async function proposeDietTags(params: {
  canonicalName: string;
  description?: string | null;
}): Promise<DietTagProposal[]> {
  const provider = requireAiProvider();
  const modelName = resolveModel(provider, "suggestion", process.env.AI_DIET_TAG_MODEL);
  const temperature = Number(process.env.AI_DIET_TAG_TEMPERATURE ?? "0.1");
  const maxOutputTokens = Number(process.env.AI_DIET_TAG_MAX_TOKENS ?? "800");

  const aiResult = await generateText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildPrompt(params),
    model: modelName,
    temperature,
    maxOutputTokens
  });

  let rawItems: DietTagRaw[] = [];
  try {
    const parsed = JSON.parse(extractJson(aiResult.text));
    if (Array.isArray(parsed)) rawItems = parsed as DietTagRaw[];
  } catch {
    rawItems = [];
  }

  return rawItems
    .filter(
      (item) =>
        VALID_DIET_TYPES.has(item.dietType) &&
        typeof item.compatible === "boolean" &&
        VALID_CONFIDENCES.has(item.confidence)
    )
    .map((item) => ({
      dietType: item.dietType as DietType,
      compatible: item.compatible as boolean,
      confidence: item.confidence as DietTagConfidence,
      reasoning: item.reasoning?.trim() || null
    }));
}

/**
 * Merges one diet-type judgment into ingredients.diet_tags (read-modify-write - never a live join) and
 * resolves the matching pending review-queue row for this (ingredient, diet type), if one exists.
 */
export async function applyDietTag(params: {
  ingredientId: number;
  dietType: DietType;
  compatible: boolean;
}): Promise<void> {
  const { ingredientId, dietType, compatible } = params;
  const [row] = await db
    .select({ dietTags: ingredients.dietTags })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId))
    .limit(1);

  const nextTags = { ...(row?.dietTags ?? {}), [dietType]: compatible };

  await db.update(ingredients).set({ dietTags: nextTags }).where(eq(ingredients.id, ingredientId));

  await db
    .update(ingredientDietCandidates)
    .set({ status: "accepted", resolvedAt: new Date() })
    .where(
      and(
        eq(ingredientDietCandidates.ingredientId, ingredientId),
        eq(ingredientDietCandidates.dietType, dietType),
        eq(ingredientDietCandidates.status, "pending")
      )
    );
}
