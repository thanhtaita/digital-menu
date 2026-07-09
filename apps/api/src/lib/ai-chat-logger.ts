import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import type { AiChatMessage, AiCompletionResult, AiProvider } from "./ai/types.js";

export type AiChatLogOperation = "chat" | "summarize";

export type AiChatLogContext = {
  userId: number;
  restaurantId: number;
  sessionId: number;
  restaurantName?: string;
};

export type AiChatLogRequest = {
  provider: AiProvider;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  systemPrompt: string;
  history?: AiChatMessage[];
  userMessage?: string;
  userPrompt?: string;
};

export type AiChatLogResponse = {
  rawText: string;
  parsedMessage?: string;
  recommendations?: Array<{ dishName: string; reason: string }>;
  parseError?: string;
  completion: Pick<AiCompletionResult, "tokensUsed" | "model" | "provider">;
};

export type AiChatLogEntry = {
  id: string;
  timestamp: string;
  operation: AiChatLogOperation;
  context: AiChatLogContext;
  request: AiChatLogRequest;
  response?: AiChatLogResponse;
  error?: { message: string; name?: string };
  timing: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
};

export function getAiChatLogsRoot(): string {
  return process.env.AI_CHAT_LOG_DIR ?? join(process.cwd(), "logs", "ai-chat");
}

export function isAiChatLoggingEnabled(): boolean {
  const value = process.env.AI_CHAT_LOG_ENABLED?.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return true;
}

export async function ensureAiChatLogsRoot(): Promise<void> {
  if (!isAiChatLoggingEnabled()) return;
  await mkdir(getAiChatLogsRoot(), { recursive: true });
}

function logFileName(timestamp: Date, id: string): string {
  const date = timestamp.toISOString().slice(0, 10);
  const time = timestamp.toISOString().slice(11, 19).replace(/:/g, "-");
  return `${date}/${time}-${id}.json`;
}

export async function writeAiChatLog(entry: AiChatLogEntry): Promise<string | null> {
  if (!isAiChatLoggingEnabled()) return null;

  const root = getAiChatLogsRoot();
  const relativePath = logFileName(new Date(entry.timestamp), entry.id);
  const filePath = join(root, relativePath);

  await mkdir(join(root, relativePath.split("/")[0]!), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");

  return filePath;
}

export function createAiChatLogId(): string {
  return randomUUID().slice(0, 8);
}

export function buildAiChatLogEntry(params: {
  id: string;
  operation: AiChatLogOperation;
  context: AiChatLogContext;
  request: AiChatLogRequest;
  startedAt: Date;
  completedAt: Date;
  response?: AiChatLogResponse;
  error?: Error;
}): AiChatLogEntry {
  const { id, operation, context, request, startedAt, completedAt, response, error } = params;

  return {
    id,
    timestamp: startedAt.toISOString(),
    operation,
    context,
    request,
    ...(response ? { response } : {}),
    ...(error ? { error: { message: error.message, name: error.name } } : {}),
    timing: {
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime()
    }
  };
}

/** Fire-and-forget file log; never throws to callers. */
export function logAiChatInteraction(entry: AiChatLogEntry): void {
  if (!isAiChatLoggingEnabled()) return;

  writeAiChatLog(entry).catch((err) => {
    console.warn("[ai-chat-logger] failed to write log:", err);
  });
}
