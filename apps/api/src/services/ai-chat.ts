import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { chat, chatStream, generateText, resolveModel, requireAiProvider } from "../lib/ai/index.js";
import type { AiChatRequest } from "../lib/ai/index.js";
import {
  buildAiChatLogEntry,
  createAiChatLogId,
  logAiChatInteraction,
  type AiChatLogRequest
} from "../lib/ai-chat-logger.js";
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

/** One diner "message" = one user question and assistant reply (2 DB rows). */
export const RECENT_EXCHANGES_WINDOW = 10;

/** DB rows per batch / recent history window (= RECENT_EXCHANGES_WINDOW × user + assistant). */
export const RECENT_MESSAGES_WINDOW = RECENT_EXCHANGES_WINDOW * 2;

/** Complete user+assistant pairs stored in the DB (ignores a trailing lone user row). */
export function countCompleteExchanges(dbRowCount: number): number {
  return Math.floor(dbRowCount / 2);
}

/** True when another full batch (RECENT_EXCHANGES_WINDOW exchanges) should be summarized. */
export function shouldRunBatchSummarization(dbRowCount: number): boolean {
  return countCompleteExchanges(dbRowCount) > RECENT_EXCHANGES_WINDOW;
}

/** Next batch to fold into the rolling summary (oldest RECENT_EXCHANGES_WINDOW exchanges). */
export function selectBatchMessagesForSummarization<T>(allMessages: T[]): T[] | null {
  if (!shouldRunBatchSummarization(allMessages.length)) return null;
  return allMessages.slice(0, RECENT_MESSAGES_WINDOW);
}

/** Messages left in the DB after one batch is removed (for tests and debugging). */
export function remainingMessagesAfterBatch<T>(allMessages: T[]): T[] {
  const batch = selectBatchMessagesForSummarization(allMessages);
  if (!batch) return allMessages;
  return allMessages.slice(RECENT_MESSAGES_WINDOW);
}

export type SummarizeMessageInput = {
  role: string;
  content: string;
  recommendations?: Array<{ dishName: string; reason: string }> | null;
};

export function buildSummarizePrompt(
  summary: string | null,
  toSummarize: SummarizeMessageInput[]
): string {
  const historyText = toSummarize
    .map((m) => {
      const { content } = formatMessageForChatHistory(m.role, m.content, m.recommendations ?? null);
      return `${m.role}: ${content}`;
    })
    .join("\n");

  return summary
    ? `Previous summary:\n${summary}\n\nNew conversation:\n${historyText}\n\nWrite a concise updated summary (2–4 sentences) of the user's food preferences and interests revealed in this conversation.`
    : `Conversation:\n${historyText}\n\nWrite a concise summary (2–4 sentences) of the user's food preferences and interests.`;
}

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
  summary: string | null,
  likedDishes: string[] = []
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

  if (likedDishes.length > 0) {
    lines.push("", `Dishes this user has liked: ${likedDishes.join(", ")}`);
    lines.push("- Favour similar dishes and flavour profiles in future recommendations");
  }

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

export function formatAssistantHistoryContent(
  content: string,
  recommendations: Array<{ dishName: string; reason: string }> | null | undefined
): string {
  if (!recommendations?.length) return content;

  const dishLines = recommendations.map((r) => {
    const reason = r.reason ? ` — ${r.reason}` : "";
    return `- ${r.dishName}${reason}`;
  });

  return `${content}\n\nRecommended dishes:\n${dishLines.join("\n")}`;
}

export function formatMessageForChatHistory(
  role: string,
  content: string,
  recommendations: Array<{ dishName: string; reason: string }> | null | undefined
): { role: "user" | "assistant"; content: string } {
  const normalizedRole = role === "user" ? ("user" as const) : ("assistant" as const);
  return {
    role: normalizedRole,
    content:
      normalizedRole === "assistant"
        ? formatAssistantHistoryContent(content, recommendations)
        : content
  };
}

export async function summarizeSession(sessionId: number, currentSummary: string | null): Promise<void> {
  let summary = currentSummary;

  while (true) {
    const allMessages = await db
      .select({
        id: aiChatMessages.id,
        role: aiChatMessages.role,
        content: aiChatMessages.content,
        recommendations: aiChatMessages.recommendations
      })
      .from(aiChatMessages)
      .where(eq(aiChatMessages.sessionId, sessionId))
      .orderBy(asc(aiChatMessages.createdAt));

    const toSummarize = selectBatchMessagesForSummarization(allMessages);
    if (!toSummarize) return;

    const provider = requireAiProvider();
    const modelName = resolveModel(provider, "summarize", process.env.AI_CHAT_SUMMARIZE_MODEL);
    const prompt = buildSummarizePrompt(summary, toSummarize);

    const [session] = await db
      .select({
        userId: aiChatSessions.userId,
        restaurantId: aiChatSessions.restaurantId
      })
      .from(aiChatSessions)
      .where(eq(aiChatSessions.id, sessionId))
      .limit(1);

    const logId = createAiChatLogId();
    const startedAt = new Date();
    const request: AiChatLogRequest = {
      provider,
      model: modelName,
      temperature: 0.3,
      maxOutputTokens: 300,
      systemPrompt: "You summarize diner food preferences from restaurant chat transcripts.",
      userPrompt: prompt
    };

    try {
      const result = await generateText({
        systemPrompt: request.systemPrompt,
        userPrompt: prompt,
        model: modelName,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens
      });
      summary = result.text.trim();
      const completedAt = new Date();

      logAiChatInteraction(
        buildAiChatLogEntry({
          id: logId,
          operation: "summarize",
          context: {
            userId: session?.userId ?? 0,
            restaurantId: session?.restaurantId ?? 0,
            sessionId
          },
          request,
          startedAt,
          completedAt,
          response: {
            rawText: result.text,
            parsedMessage: summary,
            completion: {
              tokensUsed: result.tokensUsed,
              model: result.model,
              provider: result.provider
            }
          }
        })
      );

      await db
        .update(aiChatSessions)
        .set({ conversationSummary: summary, updatedAt: new Date() })
        .where(eq(aiChatSessions.id, sessionId));

      const idsToDelete = toSummarize.map((m) => m.id);
      await db.delete(aiChatMessages).where(inArray(aiChatMessages.id, idsToDelete));
    } catch (err) {
      const completedAt = new Date();
      logAiChatInteraction(
        buildAiChatLogEntry({
          id: logId,
          operation: "summarize",
          context: {
            userId: session?.userId ?? 0,
            restaurantId: session?.restaurantId ?? 0,
            sessionId
          },
          request,
          startedAt,
          completedAt,
          error: err instanceof Error ? err : new Error(String(err))
        })
      );
      throw err;
    }
  }
}

export async function processChat(params: {
  userId: number;
  restaurantId: number;
  message: string;
}): Promise<{ message: string; recommendations: Array<{ dishName: string; reason: string }>; sessionId: number }> {
  const { userId, restaurantId, message } = params;

  const provider = requireAiProvider();

  const [{ restaurantName, menuText }, userContext, session] = await Promise.all([
    fetchMenuContext(restaurantId),
    fetchUserContext(userId),
    getOrCreateSession(userId, restaurantId)
  ]);

  const recentMessages = await db
    .select({
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      recommendations: aiChatMessages.recommendations
    })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, session.id))
    .orderBy(desc(aiChatMessages.createdAt))
    .limit(RECENT_MESSAGES_WINDOW);

  recentMessages.reverse();

  const likedDishes = (session.likedDishNames as string[] | null) ?? [];
  const systemPrompt = buildSystemPrompt(restaurantName, menuText, userContext, session.conversationSummary, likedDishes);

  const modelName = resolveModel(provider, "chat", process.env.AI_CHAT_MODEL);
  const history = recentMessages.map((m) =>
    formatMessageForChatHistory(
      m.role,
      m.content,
      m.recommendations as Array<{ dishName: string; reason: string }> | null
    )
  );

  const logId = createAiChatLogId();
  const startedAt = new Date();
  const request: AiChatLogRequest = {
    provider,
    model: modelName,
    temperature: 0.7,
    maxOutputTokens: 1000,
    jsonMode: true,
    systemPrompt,
    history,
    userMessage: message
  };

  let result;
  try {
    result = await chat({
      systemPrompt,
      history,
      userMessage: message,
      model: modelName,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      jsonMode: true
    });
  } catch (err) {
    const completedAt = new Date();
    logAiChatInteraction(
      buildAiChatLogEntry({
        id: logId,
        operation: "chat",
        context: {
          userId,
          restaurantId,
          sessionId: session.id,
          restaurantName
        },
        request,
        startedAt,
        completedAt,
        error: err instanceof Error ? err : new Error(String(err))
      })
    );
    throw err;
  }

  const responseText = result.text;
  const completedAt = new Date();

  let aiMessage = "I had trouble processing that. Please try again.";
  let recommendations: Array<{ dishName: string; reason: string }> = [];
  let parseError: string | undefined;

  try {
    const parsed = JSON.parse(responseText) as { message?: string; recommendations?: unknown[] };
    if (typeof parsed.message === "string") aiMessage = parsed.message;
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations.filter(
        (r): r is { dishName: string; reason: string } =>
          typeof r === "object" && r !== null && typeof (r as Record<string, unknown>).dishName === "string"
      );
    }
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
    aiMessage = responseText;
  }

  logAiChatInteraction(
    buildAiChatLogEntry({
      id: logId,
      operation: "chat",
      context: {
        userId,
        restaurantId,
        sessionId: session.id,
        restaurantName
      },
      request,
      startedAt,
      completedAt,
      response: {
        rawText: responseText,
        parsedMessage: aiMessage,
        recommendations,
        ...(parseError ? { parseError } : {}),
        completion: {
          tokensUsed: result.tokensUsed,
          model: result.model,
          provider: result.provider
        }
      }
    })
  );

  const now = new Date();
  await db.insert(aiChatMessages).values([
    { sessionId: session.id, role: "user", content: message, createdAt: now },
    {
      sessionId: session.id,
      role: "assistant",
      content: aiMessage,
      recommendations: recommendations.length > 0 ? recommendations : null,
      createdAt: new Date(now.getTime() + 1)
    }
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
  messages: Array<{ id: number; role: string; content: string; createdAt: string; recommendations: Array<{ dishName: string; reason: string }> }>;
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
      createdAt: m.createdAt.toISOString(),
      recommendations: (m.recommendations as Array<{ dishName: string; reason: string }> | null) ?? []
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

export async function likeDishInSession(params: {
  userId: number;
  restaurantId: number;
  dishName: string;
  liked: boolean;
}): Promise<void> {
  const session = await getOrCreateSession(params.userId, params.restaurantId);
  const current: string[] = (session.likedDishNames as string[] | null) ?? [];
  const updated = params.liked
    ? [...new Set([...current, params.dishName])]
    : current.filter((n) => n !== params.dishName);
  await db
    .update(aiChatSessions)
    .set({ likedDishNames: updated, updatedAt: new Date() })
    .where(eq(aiChatSessions.id, session.id));
}

/** Extracts the "message" field value from a partial streaming JSON response. */
export function extractPartialMessageFromJson(partialJson: string): string {
  const match = /"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(partialJson);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

export type ChatStreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; message: string; recommendations: Array<{ dishName: string; reason: string }>; sessionId: number };

export async function* processChatStream(params: {
  userId: number;
  restaurantId: number;
  message: string;
}): AsyncGenerator<ChatStreamEvent> {
  const { userId, restaurantId, message } = params;

  const provider = requireAiProvider();

  const [{ restaurantName, menuText }, userContext, session] = await Promise.all([
    fetchMenuContext(restaurantId),
    fetchUserContext(userId),
    getOrCreateSession(userId, restaurantId)
  ]);

  const recentMessages = await db
    .select({
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      recommendations: aiChatMessages.recommendations
    })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, session.id))
    .orderBy(desc(aiChatMessages.createdAt))
    .limit(RECENT_MESSAGES_WINDOW);

  recentMessages.reverse();

  const likedDishes = (session.likedDishNames as string[] | null) ?? [];
  const systemPrompt = buildSystemPrompt(restaurantName, menuText, userContext, session.conversationSummary, likedDishes);
  const modelName = resolveModel(provider, "chat", process.env.AI_CHAT_MODEL);

  const history = recentMessages.map((m) =>
    formatMessageForChatHistory(
      m.role,
      m.content,
      m.recommendations as Array<{ dishName: string; reason: string }> | null
    )
  );

  const request: AiChatRequest = {
    systemPrompt,
    history,
    userMessage: message,
    model: modelName,
    temperature: 0.7,
    maxOutputTokens: 1000,
    jsonMode: true
  };

  let accumulatedJson = "";
  let lastExtractedLength = 0;

  for await (const chunk of chatStream(request)) {
    accumulatedJson += chunk;
    const currentMessage = extractPartialMessageFromJson(accumulatedJson);
    if (currentMessage.length > lastExtractedLength) {
      yield { type: "chunk", text: currentMessage.slice(lastExtractedLength) };
      lastExtractedLength = currentMessage.length;
    }
  }

  let aiMessage = "I had trouble processing that. Please try again.";
  let recommendations: Array<{ dishName: string; reason: string }> = [];

  try {
    const parsed = JSON.parse(accumulatedJson) as { message?: string; recommendations?: unknown[] };
    if (typeof parsed.message === "string") aiMessage = parsed.message;
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations.filter(
        (r): r is { dishName: string; reason: string } =>
          typeof r === "object" && r !== null && typeof (r as Record<string, unknown>).dishName === "string"
      );
    }
  } catch {
    aiMessage = accumulatedJson || aiMessage;
  }

  const now = new Date();
  await db.insert(aiChatMessages).values([
    { sessionId: session.id, role: "user", content: message, createdAt: now },
    {
      sessionId: session.id,
      role: "assistant",
      content: aiMessage,
      recommendations: recommendations.length > 0 ? recommendations : null,
      createdAt: new Date(now.getTime() + 1)
    }
  ]);

  await db
    .update(aiChatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(aiChatSessions.id, session.id));

  summarizeSession(session.id, session.conversationSummary).catch((err) => {
    console.warn("[ai-chat] summarization failed:", err);
  });

  yield { type: "done", message: aiMessage, recommendations, sessionId: session.id };
}
