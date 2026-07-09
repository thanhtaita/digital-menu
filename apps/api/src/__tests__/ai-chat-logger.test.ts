import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  buildAiChatLogEntry,
  createAiChatLogId,
  getAiChatLogsRoot,
  isAiChatLoggingEnabled,
  writeAiChatLog
} from "../lib/ai-chat-logger.js";

describe("ai-chat-logger", () => {
  let tempDir: string;
  const previousLogDir = process.env.AI_CHAT_LOG_DIR;
  const previousLogEnabled = process.env.AI_CHAT_LOG_ENABLED;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ai-chat-logs-"));
    process.env.AI_CHAT_LOG_DIR = tempDir;
    delete process.env.AI_CHAT_LOG_ENABLED;
  });

  afterEach(async () => {
    if (previousLogDir === undefined) delete process.env.AI_CHAT_LOG_DIR;
    else process.env.AI_CHAT_LOG_DIR = previousLogDir;

    if (previousLogEnabled === undefined) delete process.env.AI_CHAT_LOG_ENABLED;
    else process.env.AI_CHAT_LOG_ENABLED = previousLogEnabled;

    await rm(tempDir, { recursive: true, force: true });
  });

  it("defaults logging to enabled", () => {
    expect(isAiChatLoggingEnabled()).toBe(true);
  });

  it("can disable logging via AI_CHAT_LOG_ENABLED=false", () => {
    process.env.AI_CHAT_LOG_ENABLED = "false";
    expect(isAiChatLoggingEnabled()).toBe(false);
  });

  it("writes a JSON log file with prompt, response, and metadata", async () => {
    const startedAt = new Date("2026-06-20T15:04:05.000Z");
    const completedAt = new Date("2026-06-20T15:04:06.250Z");
    const id = createAiChatLogId();

    const entry = buildAiChatLogEntry({
      id,
      operation: "chat",
      context: {
        userId: 7,
        restaurantId: 3,
        sessionId: 42,
        restaurantName: "Test Bistro"
      },
      request: {
        provider: "gemini",
        model: "gemini-2.0-flash",
        temperature: 0.7,
        maxOutputTokens: 1000,
        jsonMode: true,
        systemPrompt: "You are a food assistant.",
        history: [{ role: "user", content: "Hi" }],
        userMessage: "What should I order?"
      },
      startedAt,
      completedAt,
      response: {
        rawText: '{"message":"Try the soup","recommendations":[]}',
        parsedMessage: "Try the soup",
        recommendations: [],
        completion: {
          tokensUsed: 88,
          model: "gemini-2.0-flash",
          provider: "gemini"
        }
      }
    });

    const filePath = await writeAiChatLog(entry);
    expect(filePath).toContain(getAiChatLogsRoot());

    const saved = JSON.parse(await readFile(filePath!, "utf8"));
    expect(saved.operation).toBe("chat");
    expect(saved.request.systemPrompt).toBe("You are a food assistant.");
    expect(saved.request.userMessage).toBe("What should I order?");
    expect(saved.response.rawText).toContain("Try the soup");
    expect(saved.response.completion.tokensUsed).toBe(88);
    expect(saved.timing.durationMs).toBe(1250);
    expect(saved.context.restaurantName).toBe("Test Bistro");
  });
});
