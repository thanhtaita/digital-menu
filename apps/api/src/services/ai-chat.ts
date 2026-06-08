import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  restaurants,
  menus,
  menuSections,
  dishes,
  aiChatSessions,
  aiChatMessages,
  userPreferences,
  userRestrictions,
  ingredients
} from "@digital-menu/db";

const RECENT_MESSAGES_WINDOW = 10;
const SUMMARIZE_THRESHOLD = 20;

async function fetchMenuContext(restaurantId: number): Promise<{ restaurantName: string; menuText: string }> {
  const [restaurant] = await db
    .select({ name: restaurants.name })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  if (!restaurant) throw new Error("Restaurant not found");

  const rows = await db
    .select({
      sectionName: menuSections.name,
      sectionOrder: menuSections.displayOrder,
      dishName: dishes.name,
      dishDescription: dishes.description,
      dishPrice: dishes.price,
      dishOrder: dishes.displayOrder
    })
    .from(menus)
    .innerJoin(menuSections, eq(menuSections.menuId, menus.id))
    .innerJoin(dishes, eq(dishes.sectionId, menuSections.id))
    .where(
      and(
        eq(menus.restaurantId, restaurantId),
        eq(menus.isPublished, true),
        eq(dishes.isAvailable, true)
      )
    )
    .orderBy(asc(menus.displayOrder), asc(menuSections.displayOrder), asc(dishes.displayOrder));

  const sectionMap = new Map<string, string[]>();
  for (const row of rows) {
    if (!sectionMap.has(row.sectionName)) sectionMap.set(row.sectionName, []);
    const desc = row.dishDescription ? ` — ${row.dishDescription}` : "";
    sectionMap.get(row.sectionName)!.push(`  • ${row.dishName} ($${row.dishPrice})${desc}`);
  }

  const lines: string[] = [];
  for (const [section, items] of sectionMap) {
    lines.push(`[${section}]`, ...items, "");
  }

  return { restaurantName: restaurant.name, menuText: lines.join("\n").trim() };
}

async function fetchUserContext(userId: number): Promise<string> {
  const [pref] = await db
    .select({ preferenceText: userPreferences.preferenceText })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const restrictionRows = await db
    .select({
      restrictionType: userRestrictions.restrictionType,
      severity: userRestrictions.severity,
      dietType: userRestrictions.dietType,
      ingredientName: ingredients.canonicalName
    })
    .from(userRestrictions)
    .leftJoin(ingredients, eq(ingredients.id, userRestrictions.ingredientId))
    .where(eq(userRestrictions.userId, userId));

  const parts: string[] = [];
  if (pref) parts.push(`Preferences: ${pref.preferenceText}`);

  const blocked = restrictionRows
    .filter((r) => r.severity === "block")
    .map((r) => (r.restrictionType === "diet" ? r.dietType : r.ingredientName))
    .filter(Boolean);

  const disliked = restrictionRows
    .filter((r) => r.severity === "warn")
    .map((r) => (r.restrictionType === "diet" ? r.dietType : r.ingredientName))
    .filter(Boolean);

  if (blocked.length) parts.push(`Hard restrictions (never recommend): ${blocked.join(", ")}`);
  if (disliked.length) parts.push(`Dislikes (avoid if possible): ${disliked.join(", ")}`);

  return parts.length > 0 ? parts.join("\n") : "No special preferences or restrictions on file.";
}

async function getOrCreateSession(
  userId: number,
  restaurantId: number
): Promise<typeof aiChatSessions.$inferSelect> {
  const [existing] = await db
    .select()
    .from(aiChatSessions)
    .where(and(eq(aiChatSessions.userId, userId), eq(aiChatSessions.restaurantId, restaurantId)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(aiChatSessions)
    .values({ userId, restaurantId })
    .returning();

  return created!;
}

export function buildSystemPrompt(
  restaurantName: string,
  menuText: string,
  userContext: string,
  summary: string | null
): string {
  const lines = [
    `You are a friendly food recommendation assistant for ${restaurantName}.`,
    "",
    "MENU:",
    menuText,
    "",
    "USER PROFILE:",
    userContext
  ];

  if (summary) {
    lines.push("", "PREVIOUS CONVERSATION CONTEXT:", summary);
  }

  lines.push(
    "",
    "Guidelines:",
    "- Only recommend dishes that appear in the MENU above — never invent dishes",
    "- Respect hard restrictions absolutely; avoid dislikes when possible",
    "- Be warm, concise, and conversational",
    "- When recommending, briefly explain why it fits the user",
    "",
    'Respond ONLY with valid JSON — no markdown, no extra text:',
    '{"message":"Your conversational reply","recommendations":[{"dishName":"Exact name from menu","reason":"Short reason"}]}',
    "Include 1–5 recommendations when relevant; use [] if the message needs no dish suggestions."
  );

  return lines.join("\n");
}

async function summarizeSession(sessionId: number, currentSummary: string | null): Promise<void> {
  const allMessages = await db
    .select({ id: aiChatMessages.id, role: aiChatMessages.role, content: aiChatMessages.content })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(asc(aiChatMessages.createdAt));

  if (allMessages.length <= SUMMARIZE_THRESHOLD) return;

  const toSummarize = allMessages.slice(0, allMessages.length - RECENT_MESSAGES_WINDOW);

  const apiKey = process.env.GEMINI_API_KEY!;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const historyText = toSummarize.map((m) => `${m.role}: ${m.content}`).join("\n");
  const prompt = currentSummary
    ? `Previous summary:\n${currentSummary}\n\nNew conversation:\n${historyText}\n\nWrite a concise updated summary (2–4 sentences) of the user's food preferences and interests revealed in this conversation.`
    : `Conversation:\n${historyText}\n\nWrite a concise summary (2–4 sentences) of the user's food preferences and interests.`;

  const result = await model.generateContent(prompt);
  const newSummary = result.response.text().trim();

  await db
    .update(aiChatSessions)
    .set({ conversationSummary: newSummary, updatedAt: new Date() })
    .where(eq(aiChatSessions.id, sessionId));

  const idsToDelete = toSummarize.map((m) => m.id);
  await db.delete(aiChatMessages).where(inArray(aiChatMessages.id, idsToDelete));
}

export async function processChat(params: {
  userId: number;
  restaurantId: number;
  message: string;
}): Promise<{ message: string; recommendations: Array<{ dishName: string; reason: string }>; sessionId: number }> {
  const { userId, restaurantId, message } = params;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const [{ restaurantName, menuText }, userContext, session] = await Promise.all([
    fetchMenuContext(restaurantId),
    fetchUserContext(userId),
    getOrCreateSession(userId, restaurantId)
  ]);

  const recentMessages = await db
    .select({ role: aiChatMessages.role, content: aiChatMessages.content })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, session.id))
    .orderBy(desc(aiChatMessages.createdAt))
    .limit(RECENT_MESSAGES_WINDOW);

  recentMessages.reverse();

  const systemPrompt = buildSystemPrompt(restaurantName, menuText, userContext, session.conversationSummary);

  const chatHistory = recentMessages.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }]
  }));

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.AI_CHAT_MODEL ?? "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
      responseMimeType: "application/json"
    }
  });

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(message);
  const responseText = result.response.text();

  let aiMessage = "I had trouble processing that. Please try again.";
  let recommendations: Array<{ dishName: string; reason: string }> = [];

  try {
    const parsed = JSON.parse(responseText) as { message?: string; recommendations?: unknown[] };
    if (typeof parsed.message === "string") aiMessage = parsed.message;
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations.filter(
        (r): r is { dishName: string; reason: string } =>
          typeof r === "object" && r !== null && typeof (r as Record<string, unknown>).dishName === "string"
      );
    }
  } catch {
    aiMessage = responseText;
  }

  const now = new Date();
  await db.insert(aiChatMessages).values([
    { sessionId: session.id, role: "user", content: message, createdAt: now },
    { sessionId: session.id, role: "assistant", content: aiMessage, createdAt: new Date(now.getTime() + 1) }
  ]);

  await db
    .update(aiChatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(aiChatSessions.id, session.id));

  summarizeSession(session.id, session.conversationSummary).catch((err) => {
    console.warn("[ai-chat] summarization failed:", err);
  });

  return { message: aiMessage, recommendations, sessionId: session.id };
}

export async function getChatHistory(params: {
  userId: number;
  restaurantId: number;
}): Promise<{
  restaurantName: string;
  messages: Array<{ id: number; role: string; content: string; createdAt: string }>;
  summary: string | null;
}> {
  const { userId, restaurantId } = params;

  const [restaurant] = await db
    .select({ name: restaurants.name })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);

  const restaurantName = restaurant?.name ?? "Restaurant";

  const [session] = await db
    .select()
    .from(aiChatSessions)
    .where(and(eq(aiChatSessions.userId, userId), eq(aiChatSessions.restaurantId, restaurantId)))
    .limit(1);

  if (!session) return { restaurantName, messages: [], summary: null };

  const messages = await db
    .select()
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, session.id))
    .orderBy(asc(aiChatMessages.createdAt));

  return {
    restaurantName,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString()
    })),
    summary: session.conversationSummary
  };
}

export async function clearChatSession(params: { userId: number; restaurantId: number }): Promise<void> {
  await db
    .delete(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.userId, params.userId),
        eq(aiChatSessions.restaurantId, params.restaurantId)
      )
    );
}
