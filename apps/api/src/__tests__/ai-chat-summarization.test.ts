import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RECENT_EXCHANGES_WINDOW,
  RECENT_MESSAGES_WINDOW,
  countCompleteExchanges,
  shouldRunBatchSummarization,
  selectBatchMessagesForSummarization,
  remainingMessagesAfterBatch,
  buildSummarizePrompt,
  summarizeSession
} from "../services/ai-chat.js";

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("../lib/ai/index.js", () => ({
  generateText: vi.fn(),
  requireAiProvider: vi.fn(),
  resolveModel: vi.fn()
}));

vi.mock("../lib/ai-chat-logger.js", () => ({
  buildAiChatLogEntry: vi.fn((entry) => entry),
  createAiChatLogId: vi.fn(() => "test-log-id"),
  logAiChatInteraction: vi.fn()
}));

import { db } from "../lib/db.js";
import { generateText, requireAiProvider, resolveModel } from "../lib/ai/index.js";

type StoredMessage = {
  id: number;
  role: string;
  content: string;
  recommendations: Array<{ dishName: string; reason: string }> | null;
};

function dbChain<T>(data: T) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "orderBy", "set"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: T) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(data).then(res, rej),
    configurable: true
  });
  return chain as unknown;
}

/** Build `pairCount` exchanges (user + assistant), each 2 DB rows. */
function makeExchanges(pairCount: number, startId = 1): StoredMessage[] {
  const messages: StoredMessage[] = [];
  for (let p = 0; p < pairCount; p++) {
    const exchange = startId + p;
    messages.push(
      { id: exchange * 2 - 1, role: "user", content: `exchange ${exchange} user`, recommendations: null },
      { id: exchange * 2, role: "assistant", content: `exchange ${exchange} assistant`, recommendations: null }
    );
  }
  return messages;
}

function setupSummarizeDb(messages: StoredMessage[]) {
  let stored = [...messages];
  let selectCall = 0;

  vi.mocked(db.select).mockImplementation(() => {
    selectCall += 1;
    if (selectCall % 2 === 1) {
      return dbChain(stored) as ReturnType<typeof db.select>;
    }
    return dbChain([{ userId: 1, restaurantId: 5 }]) as ReturnType<typeof db.select>;
  });

  vi.mocked(db.update).mockReturnValue(dbChain([]) as ReturnType<typeof db.update>);

  vi.mocked(db.delete).mockImplementation(() => {
    if (stored.length > RECENT_MESSAGES_WINDOW) {
      stored = stored.slice(RECENT_MESSAGES_WINDOW);
    }
    return dbChain([]) as ReturnType<typeof db.delete>;
  });

  return {
    getStored: () => stored
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAiProvider).mockReturnValue("gemini");
  vi.mocked(resolveModel).mockReturnValue("gemini-2.0-flash-lite");
  vi.mocked(generateText).mockResolvedValue({
    text: "Updated summary.",
    tokensUsed: 12,
    model: "gemini-2.0-flash-lite",
    provider: "gemini"
  });
});

describe("batch summarization boundaries", () => {
  it("defines one message as one user+assistant exchange (2 DB rows)", () => {
    expect(RECENT_EXCHANGES_WINDOW).toBe(10);
    expect(RECENT_MESSAGES_WINDOW).toBe(20);
  });

  it("does not batch at or below 10 exchanges (20 DB rows)", () => {
    const messages = makeExchanges(10);
    expect(messages).toHaveLength(20);
    expect(shouldRunBatchSummarization(messages.length)).toBe(false);
    expect(selectBatchMessagesForSummarization(messages)).toBeNull();
    expect(remainingMessagesAfterBatch(messages)).toEqual(messages);
  });

  it("does not batch after 10 exchanges plus a lone user row (21 DB rows)", () => {
    const messages = [...makeExchanges(10), { id: 21, role: "user", content: "pending", recommendations: null }];
    expect(countCompleteExchanges(messages.length)).toBe(10);
    expect(shouldRunBatchSummarization(messages.length)).toBe(false);
  });

  it("batches the first 10 exchanges when the 11th exchange completes (22 DB rows)", () => {
    const messages = makeExchanges(11);
    expect(messages).toHaveLength(22);
    expect(selectBatchMessagesForSummarization(messages)?.map((m) => m.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
    ]);
    expect(remainingMessagesAfterBatch(messages).map((m) => m.id)).toEqual([21, 22]);
  });

  it("does not batch again until another 10 exchanges accumulate in the tail", () => {
    const afterFirstBatch = makeExchanges(10, 11);
    expect(afterFirstBatch).toHaveLength(20);
    expect(shouldRunBatchSummarization(afterFirstBatch.length)).toBe(false);

    const readyForSecondBatch = makeExchanges(11, 11);
    expect(readyForSecondBatch).toHaveLength(22);
    expect(selectBatchMessagesForSummarization(readyForSecondBatch)?.map((m) => m.id)).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40
    ]);
    expect(remainingMessagesAfterBatch(readyForSecondBatch).map((m) => m.id)).toEqual([41, 42]);
  });

  it("processes two batches in one run when 21 exchanges exist (42 DB rows)", () => {
    const messages = makeExchanges(21);
    expect(messages).toHaveLength(42);

    const afterFirst = remainingMessagesAfterBatch(messages);
    expect(afterFirst).toHaveLength(22);
    expect(shouldRunBatchSummarization(afterFirst.length)).toBe(true);

    const afterSecond = remainingMessagesAfterBatch(afterFirst);
    expect(afterSecond).toHaveLength(2);
    expect(shouldRunBatchSummarization(afterSecond.length)).toBe(false);
  });
});

describe("buildSummarizePrompt", () => {
  it("builds a first-batch prompt without a previous summary", () => {
    const prompt = buildSummarizePrompt(null, [
      { role: "user", content: "Something light" },
      { role: "assistant", content: "Try the soup." }
    ]);

    expect(prompt).toContain("Conversation:");
    expect(prompt).not.toContain("Previous summary:");
    expect(prompt).toContain("user: Something light");
    expect(prompt).toContain("assistant: Try the soup.");
  });

  it("merges a previous summary with the next batch", () => {
    const prompt = buildSummarizePrompt("User likes light dishes.", [
      { role: "user", content: "Are they vegan?" },
      { role: "assistant", content: "Only one is fully plant-based." }
    ]);

    expect(prompt).toContain("Previous summary:\nUser likes light dishes.");
    expect(prompt).toContain("New conversation:");
    expect(prompt).toContain("user: Are they vegan?");
  });

  it("includes recommendation details in the batch transcript", () => {
    const prompt = buildSummarizePrompt(null, [
      {
        role: "assistant",
        content: "Here are some options!",
        recommendations: [{ dishName: "Tofu Bowl", reason: "Fully plant-based" }]
      }
    ]);

    expect(prompt).toContain("Recommended dishes:");
    expect(prompt).toContain("Tofu Bowl — Fully plant-based");
  });
});

describe("summarizeSession", () => {
  it("is a no-op when the session has at most 10 exchanges (20 DB rows)", async () => {
    setupSummarizeDb(makeExchanges(10));

    await summarizeSession(99, null);

    expect(generateText).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("summarizes the first 10 exchanges when the 11th exchange completes", async () => {
    const { getStored } = setupSummarizeDb(makeExchanges(11));

    await summarizeSession(99, null);

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining("Conversation:")
      })
    );
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(getStored()).toHaveLength(2);
    expect(getStored().map((m) => m.id)).toEqual([21, 22]);
  });

  it("merges the existing summary when summarizing the second batch of exchanges", async () => {
    setupSummarizeDb(makeExchanges(11, 11));

    await summarizeSession(99, "Summary of exchanges 1-10.");

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining("Previous summary:\nSummary of exchanges 1-10.")
      })
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining("exchange 11 user")
      })
    );
  });

  it("runs catch-up batches when more than one batch is pending", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: "Summary after batch 1.",
        tokensUsed: 10,
        model: "gemini-2.0-flash-lite",
        provider: "gemini"
      })
      .mockResolvedValueOnce({
        text: "Summary after batch 2.",
        tokensUsed: 10,
        model: "gemini-2.0-flash-lite",
        provider: "gemini"
      });

    const { getStored } = setupSummarizeDb(makeExchanges(21));

    await summarizeSession(99, null);

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(db.delete).toHaveBeenCalledTimes(2);
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(getStored()).toHaveLength(2);
    expect(getStored().map((m) => m.id)).toEqual([41, 42]);

    expect(generateText.mock.calls[1]?.[0]?.userPrompt).toContain(
      "Previous summary:\nSummary after batch 1."
    );
  });

  it("propagates summarize model failures without deleting messages", async () => {
    setupSummarizeDb(makeExchanges(11));
    vi.mocked(generateText).mockRejectedValueOnce(new Error("provider down"));

    await expect(summarizeSession(99, null)).rejects.toThrow("provider down");

    expect(db.delete).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
