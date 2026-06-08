import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import { ingredients } from "@digital-menu/db";

const FUZZY_THRESHOLD = Number(process.env.AI_FUZZY_MATCH_THRESHOLD ?? "0.6");

const SYSTEM_PROMPT = `You are a culinary expert helping restaurant staff tag dish ingredients.

Given a dish name and optional description, extract ALL ingredients typically in this dish. Include:
- Main proteins, vegetables, grains
- Sauces, spices, seasonings
- Garnishes and toppings
- Common allergens (nuts, dairy, gluten items)

Return ONLY a valid JSON array. No markdown, no explanation, no extra text.
Each element must have:
- name: canonical ingredient name (lowercase, singular, English)
- confidence: "high" | "medium" | "low"
- category: "protein" | "vegetable" | "grain" | "sauce" | "spice" | "garnish" | "other"

Example:
[{"name":"rice noodles","confidence":"high","category":"grain"},{"name":"shrimp","confidence":"high","category":"protein"}]`;

type AiIngredientRaw = {
  name: string;
  confidence: "high" | "medium" | "low";
  category: string;
};

export type MatchedIngredient = {
  id: number;
  canonicalName: string;
  slug: string;
  status: "approved" | "pending";
};

export type IngredientSuggestionResult = {
  suggestedName: string;
  matchedIngredient: MatchedIngredient | null;
  confidence: "high" | "medium" | "low";
  shouldCreate: boolean;
  category?: string;
};

export type SuggestIngredientsResult = {
  suggestions: IngredientSuggestionResult[];
  metadata: { model: string; tokensUsed: number; latencyMs: number };
};

function buildPrompt(params: {
  dishName: string;
  description?: string;
  contextPrompt?: string;
  cuisineType?: string;
}): string {
  const lines = [`Dish name: "${params.dishName}"`];
  if (params.description) lines.push(`Description: "${params.description}"`);
  if (params.cuisineType) lines.push(`Cuisine: "${params.cuisineType}"`);
  if (params.contextPrompt) lines.push(`Additional context: "${params.contextPrompt}"`);
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

async function findMatch(name: string, restaurantId: number): Promise<MatchedIngredient | null> {
  const visibleWhere = or(
    eq(ingredients.approvalStatus, "approved"),
    and(
      eq(ingredients.approvalStatus, "pending"),
      eq(ingredients.requestedByRestaurantId, restaurantId)
    )
  )!;

  // Exact case-insensitive match first
  const exact = await db
    .select({ id: ingredients.id, canonicalName: ingredients.canonicalName, slug: ingredients.slug, approvalStatus: ingredients.approvalStatus })
    .from(ingredients)
    .where(and(ilike(ingredients.canonicalName, name.trim()), visibleWhere))
    .limit(1);

  if (exact.length > 0) {
    const r = exact[0]!;
    return { id: r.id, canonicalName: r.canonicalName, slug: r.slug, status: r.approvalStatus as "approved" | "pending" };
  }

  // Fuzzy match via pg_trgm (requires extension; silently skipped if unavailable)
  try {
    type FuzzyRow = { id: number; canonical_name: string; slug: string; approval_status: string; sim_score: number };
    const result = await db.execute<FuzzyRow>(sql`
      SELECT id, canonical_name, slug, approval_status,
             similarity(canonical_name, ${name.toLowerCase()}) AS sim_score
      FROM ingredients
      WHERE (approval_status = 'approved' OR (approval_status = 'pending' AND requested_by_restaurant_id = ${restaurantId}))
        AND similarity(canonical_name, ${name.toLowerCase()}) > ${FUZZY_THRESHOLD}
      ORDER BY sim_score DESC
      LIMIT 1
    `);
    const row = result.rows?.[0];
    if (row) {
      return { id: row.id, canonicalName: row.canonical_name, slug: row.slug, status: row.approval_status as "approved" | "pending" };
    }
  } catch {
    // pg_trgm not available — fuzzy match skipped
  }

  return null;
}

export async function suggestIngredients(params: {
  dishName: string;
  description?: string;
  contextPrompt?: string;
  cuisineType?: string;
  restaurantId: number;
}): Promise<SuggestIngredientsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const modelName = process.env.AI_SUGGESTION_MODEL ?? "gemini-2.0-flash-lite";
  const temperature = Number(process.env.AI_SUGGESTION_TEMPERATURE ?? "0.3");
  const maxOutputTokens = Number(process.env.AI_SUGGESTION_MAX_TOKENS ?? "1000");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { temperature, maxOutputTokens }
  });

  const t0 = Date.now();
  const aiResult = await model.generateContent(buildPrompt(params));
  const latencyMs = Date.now() - t0;

  const text = aiResult.response.text();
  const tokensUsed = aiResult.response.usageMetadata?.totalTokenCount ?? 0;

  let rawItems: AiIngredientRaw[] = [];
  try {
    const parsed = JSON.parse(extractJson(text));
    if (Array.isArray(parsed)) rawItems = parsed as AiIngredientRaw[];
  } catch {
    rawItems = [];
  }

  // Filter out low-confidence per plan Q2: only show high + medium
  const items = rawItems.filter((i) => i.confidence === "high" || i.confidence === "medium");

  const suggestions = await Promise.all(
    items.map(async (item) => {
      const matched = await findMatch(item.name, params.restaurantId);
      return {
        suggestedName: item.name,
        matchedIngredient: matched,
        confidence: item.confidence,
        shouldCreate: matched === null,
        category: item.category
      } satisfies IngredientSuggestionResult;
    })
  );

  return { suggestions, metadata: { model: modelName, tokensUsed, latencyMs } };
}
