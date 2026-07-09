import { geminiChat, geminiChatStream, geminiGenerateText } from "./channels/gemini.js";
import { openAiChat, openAiChatStream, openAiGenerateText } from "./channels/openai.js";
import { requireAiProvider } from "./config.js";
import type { AiChatRequest, AiCompletionResult, AiGenerateRequest } from "./types.js";

export {
  isAiConfigured,
  requireAiProvider,
  resolveAiProvider,
  resolveModel
} from "./config.js";
export {
  AiNotConfiguredError,
  isAiNotConfiguredError,
  type AiChatMessage,
  type AiChatRequest,
  type AiCompletionResult,
  type AiGenerateRequest,
  type AiProvider
} from "./types.js";

function channelFor(provider: ReturnType<typeof requireAiProvider>) {
  return provider === "openai"
    ? { generateText: openAiGenerateText, chat: openAiChat, chatStream: openAiChatStream }
    : { generateText: geminiGenerateText, chat: geminiChat, chatStream: geminiChatStream };
}

export async function generateText(request: AiGenerateRequest): Promise<AiCompletionResult> {
  const provider = requireAiProvider();
  return channelFor(provider).generateText(request);
}

export async function chat(request: AiChatRequest): Promise<AiCompletionResult> {
  const provider = requireAiProvider();
  return channelFor(provider).chat(request);
}

export async function* chatStream(request: AiChatRequest): AsyncGenerator<string> {
  const provider = requireAiProvider();
  yield* channelFor(provider).chatStream(request);
}
