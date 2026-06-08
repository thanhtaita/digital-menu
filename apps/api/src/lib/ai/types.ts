export type AiProvider = "gemini" | "openai";

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiGenerateRequest = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiChatRequest = {
  systemPrompt: string;
  history: AiChatMessage[];
  userMessage: string;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
};

export type AiCompletionResult = {
  text: string;
  tokensUsed: number;
  model: string;
  provider: AiProvider;
};

export class AiNotConfiguredError extends Error {
  readonly code = "AI_NOT_CONFIGURED" as const;

  constructor() {
    super("AI provider is not configured (set GEMINI_API_KEY or OPENAI_API_KEY)");
    this.name = "AiNotConfiguredError";
  }
}

export function isAiNotConfiguredError(err: unknown): boolean {
  return err instanceof AiNotConfiguredError || (err instanceof Error && err.message.includes("AI_NOT_CONFIGURED"));
}
