import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSystemPrompt, getChatHistory, clearChatSession, processChat, formatAssistantHistoryContent, formatMessageForChatHistory, shouldRunBatchSummarization, selectBatchMessagesForSummarization, RECENT_EXCHANGES_WINDOW, RECENT_MESSAGES_WINDOW } from "../services/ai-chat.js";

// ─── DB mock ──────────────────────────────────────────────────────────────────

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../lib/ai/index.js", () => ({
  chat: vi.fn(),
  generateText: vi.fn(),
  requireAiProvider: vi.fn(),
  resolveModel: vi.fn(),
}));

import { db } from "../lib/db.js";
import { chat, requireAiProvider, resolveModel } from "../lib/ai/index.js";

// Reset all mock implementations before each test to prevent state leaking between tests.
beforeEach(() => {
  vi.resetAllMocks();
});

/**
 * Creates a Drizzle-like query chain that resolves to `data` when awaited.
 * All chain methods (from, where, limit, etc.) return the same chain.
 */
function dbChain<T>(data: T) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "orderBy", "leftJoin", "innerJoin", "values", "set", "returning"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: T) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(data).then(res, rej),
    configurable: true,
  });
  return chain as unknown;
}

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  const name = "The Test Bistro";
  const menu = "[Starters]\n  • Soup ($6.00) — Warm broth";
  const userCtx = "Preferences: loves spicy food";

  it("contains the restaurant name", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, null);
    expect(prompt).toContain("The Test Bistro");
  });

  it("contains the menu text", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, null);
    expect(prompt).toContain("Soup ($6.00)");
  });

  it("contains the user profile section", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, null);
    expect(prompt).toContain("loves spicy food");
  });

  it("omits previous context section when summary is null", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, null);
    expect(prompt).not.toContain("PREVIOUS CONVERSATION CONTEXT");
  });

  it("includes the summary when provided", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, "User likes vegan options.");
    expect(prompt).toContain("PREVIOUS CONVERSATION CONTEXT");
    expect(prompt).toContain("User likes vegan options.");
  });

  it("instructs the model to return JSON", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, null);
    expect(prompt).toContain('"message"');
    expect(prompt).toContain('"recommendations"');
  });

  it("instructs the model not to invent dishes", () => {
    const prompt = buildSystemPrompt(name, menu, userCtx, null);
    expect(prompt.toLowerCase()).toContain("only recommend dishes that appear in the menu above");
  });
});

// ─── formatAssistantHistoryContent ────────────────────────────────────────────

describe("formatAssistantHistoryContent", () => {
  it("returns content unchanged when there are no recommendations", () => {
    expect(formatAssistantHistoryContent("Here are some options!", null)).toBe("Here are some options!");
    expect(formatAssistantHistoryContent("Here are some options!", [])).toBe("Here are some options!");
  });

  it("appends recommended dishes with reasons for follow-up context", () => {
    const result = formatAssistantHistoryContent("Here are some light options!", [
      { dishName: "Tofu Quinoa Buddha Bowl", reason: "Fully plant-based" },
      { dishName: "Plain Potato & Leek Soup", reason: "Gentle and mild" }
    ]);

    expect(result).toContain("Here are some light options!");
    expect(result).toContain("Recommended dishes:");
    expect(result).toContain("- Tofu Quinoa Buddha Bowl — Fully plant-based");
    expect(result).toContain("- Plain Potato & Leek Soup — Gentle and mild");
  });
});

describe("formatMessageForChatHistory", () => {
  it("leaves user messages unchanged", () => {
    expect(formatMessageForChatHistory("user", "Something light", null)).toEqual({
      role: "user",
      content: "Something light"
    });
  });

  it("enriches assistant messages with stored recommendations", () => {
    const result = formatMessageForChatHistory("assistant", "Here are some options!", [
      { dishName: "Spicy Tuna Roll", reason: "Matches your sushi preference" }
    ]);

    expect(result.role).toBe("assistant");
    expect(result.content).toContain("Spicy Tuna Roll");
  });
});

// ─── batch summarization helpers ──────────────────────────────────────────────

describe("batch summarization helpers", () => {
  it("does not summarize when at or below 10 exchanges (20 DB rows)", () => {
    const rows = Array.from({ length: RECENT_MESSAGES_WINDOW }, (_, i) => i);
    expect(shouldRunBatchSummarization(rows.length)).toBe(false);
    expect(selectBatchMessagesForSummarization(rows)).toBeNull();
  });

  it("summarizes the first 10 exchanges when the 11th exchange completes (22 DB rows)", () => {
    const rows = Array.from({ length: RECENT_MESSAGES_WINDOW + 2 }, (_, i) => i);
    expect(shouldRunBatchSummarization(rows.length)).toBe(true);
    expect(selectBatchMessagesForSummarization(rows)).toEqual(rows.slice(0, RECENT_MESSAGES_WINDOW));
  });

  it("still summarizes only one exchange-batch at a time when more are pending", () => {
    const rows = Array.from({ length: RECENT_MESSAGES_WINDOW * 2 + 2 }, (_, i) => i);
    expect(selectBatchMessagesForSummarization(rows)?.length).toBe(RECENT_MESSAGES_WINDOW);
  });

  it("uses 10 exchanges and 20 DB rows per window", () => {
    expect(RECENT_EXCHANGES_WINDOW).toBe(10);
    expect(RECENT_MESSAGES_WINDOW).toBe(20);
  });
});

// ─── getChatHistory ───────────────────────────────────────────────────────────

describe("getChatHistory", () => {

  it("returns empty history when no session exists", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(dbChain([{ name: "Pasta Palace" }]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain([]) as ReturnType<typeof db.select>); // no session

    const result = await getChatHistory({ userId: 1, restaurantId: 10 });

    expect(result.restaurantName).toBe("Pasta Palace");
    expect(result.messages).toHaveLength(0);
    expect(result.summary).toBeNull();
  });

  it("returns messages and summary from existing session", async () => {
    const mockSession = {
      id: 42,
      userId: 1,
      restaurantId: 10,
      conversationSummary: "User loves spicy noodles.",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockMessages = [
      { id: 1, sessionId: 42, role: "user", content: "What's good here?", createdAt: new Date("2026-06-07T10:00:00Z") },
      { id: 2, sessionId: 42, role: "assistant", content: "Try the ramen!", createdAt: new Date("2026-06-07T10:00:01Z") },
    ];

    vi.mocked(db.select)
      .mockReturnValueOnce(dbChain([{ name: "Ramen House" }]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain([mockSession]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(mockMessages) as ReturnType<typeof db.select>);

    const result = await getChatHistory({ userId: 1, restaurantId: 10 });

    expect(result.restaurantName).toBe("Ramen House");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("What's good here?");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.summary).toBe("User loves spicy noodles.");
  });

  it("maps message createdAt to ISO string", async () => {
    const date = new Date("2026-06-07T12:30:00.000Z");
    const mockSession = { id: 1, userId: 1, restaurantId: 10, conversationSummary: null, createdAt: date, updatedAt: date };
    const mockMessages = [{ id: 1, sessionId: 1, role: "user", content: "Hi", createdAt: date }];

    vi.mocked(db.select)
      .mockReturnValueOnce(dbChain([{ name: "Bistro" }]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain([mockSession]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(mockMessages) as ReturnType<typeof db.select>);

    const result = await getChatHistory({ userId: 1, restaurantId: 10 });

    expect(result.messages[0].createdAt).toBe(date.toISOString());
  });

  it("uses fallback restaurant name when restaurant row is missing", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(dbChain([]) as ReturnType<typeof db.select>) // no restaurant row
      .mockReturnValueOnce(dbChain([]) as ReturnType<typeof db.select>); // no session

    const result = await getChatHistory({ userId: 1, restaurantId: 999 });

    expect(result.restaurantName).toBe("Restaurant");
  });
});

// ─── clearChatSession ─────────────────────────────────────────────────────────

describe("clearChatSession", () => {

  it("deletes the session row", async () => {
    const mockDeleteChain = dbChain([]);
    vi.mocked(db.delete).mockReturnValue(mockDeleteChain as ReturnType<typeof db.delete>);

    await clearChatSession({ userId: 3, restaurantId: 7 });

    expect(db.delete).toHaveBeenCalledOnce();
  });
});

// ─── processChat — error cases ────────────────────────────────────────────────

describe("processChat", () => {
  beforeEach(() => {
    vi.mocked(requireAiProvider).mockReturnValue("gemini");
    vi.mocked(resolveModel).mockReturnValue("gemini-2.0-flash");
  });

  it("throws when no AI provider is configured", async () => {
    const { AiNotConfiguredError } = await import("../lib/ai/types.js");
    vi.mocked(requireAiProvider).mockImplementation(() => {
      throw new AiNotConfiguredError();
    });

    await expect(
      processChat({ userId: 1, restaurantId: 1, message: "Hello" })
    ).rejects.toThrow("AI provider is not configured");
  });

  // Promise.all([fetchMenuContext, fetchUserContext, getOrCreateSession]) starts all three
  // concurrently. All three call db.select() synchronously before any await, so the order is:
  //   [0] fetchMenuContext → restaurant lookup
  //   [1] fetchUserContext → preference lookup
  //   [2] getOrCreateSession → session lookup
  //   [3] fetchMenuContext resumes → menu rows
  //   [4] fetchUserContext resumes → restrictions
  //   [5] after Promise.all → recent messages
  //   [fallback] → returns [] for any further calls (e.g. the summarization check)
  //
  // Note: recentMessages should be in DESC order (newest first) because the service
  // fetches with orderBy(desc(...)) then calls .reverse() to get chronological order.
  function setupProcessChatMocks(overrides: {
    restaurant?: unknown[];
    pref?: unknown[];
    session?: unknown[];
    menuRows?: unknown[];
    restrictions?: unknown[];
    recentMessages?: unknown[];
  } = {}) {
    const mockSession = [{ id: 99, userId: 1, restaurantId: 5, conversationSummary: null, createdAt: new Date(), updatedAt: new Date() }];
    vi.mocked(db.select)
      .mockReturnValueOnce(dbChain(overrides.restaurant ?? [{ name: "Sushi Bar" }]) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(overrides.pref ?? []) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(overrides.session ?? mockSession) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(overrides.menuRows ?? []) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(overrides.restrictions ?? []) as ReturnType<typeof db.select>)
      .mockReturnValueOnce(dbChain(overrides.recentMessages ?? []) as ReturnType<typeof db.select>)
      // Fallback for summarizeSession's allMessages check (fire-and-forget after processChat).
      // Returning [] ensures summarizeSession returns early (≤ 10 exchanges / 20 DB rows).
      .mockReturnValue(dbChain([]) as ReturnType<typeof db.select>);

    vi.mocked(db.insert).mockReturnValue(dbChain([]) as ReturnType<typeof db.insert>);
    vi.mocked(db.update).mockReturnValue(dbChain([]) as ReturnType<typeof db.update>);
  }

  it("returns message and recommendations from AI JSON response", async () => {
    setupProcessChatMocks({
      restaurant: [{ name: "Sushi Bar" }],
      pref: [{ preferenceText: "I love sushi" }],
      menuRows: [{ sectionName: "Mains", dishName: "Spicy Tuna Roll", dishDescription: "Fresh tuna", dishPrice: "14.00" }],
    });

    const aiResponse = JSON.stringify({
      message: "I recommend the Spicy Tuna Roll!",
      recommendations: [{ dishName: "Spicy Tuna Roll", reason: "Matches your sushi preference" }],
    });

    vi.mocked(chat).mockResolvedValue({
      text: aiResponse,
      tokensUsed: 42,
      model: "gemini-2.0-flash",
      provider: "gemini"
    });

    const result = await processChat({ userId: 1, restaurantId: 5, message: "What should I order?" });

    expect(result.message).toBe("I recommend the Spicy Tuna Roll!");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].dishName).toBe("Spicy Tuna Roll");
    expect(result.sessionId).toBe(99);
  });

  it("falls back to raw text when AI response is not valid JSON", async () => {
    setupProcessChatMocks();

    const rawText = "Here are my suggestions: the pasta is excellent.";
    vi.mocked(chat).mockResolvedValue({
      text: rawText,
      tokensUsed: 10,
      model: "gemini-2.0-flash",
      provider: "gemini"
    });

    const result = await processChat({ userId: 1, restaurantId: 5, message: "Recommend something" });

    expect(result.message).toBe(rawText);
    expect(result.recommendations).toHaveLength(0);
  });

  it("passes conversation history to the AI channel in chronological order", async () => {
    // DESC order (newest first) — the service fetches with orderBy(desc(...)) then calls
    // .reverse(), so we must provide them newest-first to end up chronological after reversal.
    setupProcessChatMocks({
      recentMessages: [
        { role: "assistant", content: "Yes! We have the Margherita pizza." }, // newer → index 0 in DESC
        { role: "user", content: "Do you have vegetarian options?" },          // older → index 1 in DESC
      ],
    });

    vi.mocked(chat).mockResolvedValue({
      text: JSON.stringify({ message: "Great choice!", recommendations: [] }),
      tokensUsed: 8,
      model: "gemini-2.0-flash",
      provider: "gemini"
    });

    await processChat({ userId: 1, restaurantId: 5, message: "Tell me more" });

    const callArg = vi.mocked(chat).mock.calls[0][0];
    expect(callArg.history).toHaveLength(2);
    expect(callArg.history[0].role).toBe("user");
    expect(callArg.history[1].role).toBe("assistant");
  });

  it("includes stored recommendations in assistant history for follow-up questions", async () => {
    setupProcessChatMocks({
      recentMessages: [
        {
          role: "assistant",
          content: "Here are some light options!",
          recommendations: [
            { dishName: "Tofu Quinoa Buddha Bowl", reason: "Fully plant-based" },
            { dishName: "Plain Potato & Leek Soup", reason: "Gentle and mild" }
          ]
        },
        { role: "user", content: "Something light" }
      ]
    });

    vi.mocked(chat).mockResolvedValue({
      text: JSON.stringify({ message: "Only the tofu bowl is vegan.", recommendations: [] }),
      tokensUsed: 8,
      model: "gemini-2.0-flash",
      provider: "gemini"
    });

    await processChat({ userId: 1, restaurantId: 5, message: "Are they all vegan?" });

    const assistantHistory = vi.mocked(chat).mock.calls[0][0].history[1];
    expect(assistantHistory.content).toContain("Recommended dishes:");
    expect(assistantHistory.content).toContain("Tofu Quinoa Buddha Bowl");
    expect(assistantHistory.content).toContain("Plain Potato & Leek Soup");
  });
});
