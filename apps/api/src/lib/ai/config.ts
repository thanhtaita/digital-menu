import type { AiProvider } from "./types.js";
import { AiNotConfiguredError } from "./types.js";

const PROVIDER_ENV = "AI_PROVIDER";

const DEFAULT_MODELS: Record<AiProvider, { chat: string; suggestion: string; summarize: string }> = {
  gemini: {
    chat: "gemini-2.0-flash",
    suggestion: "gemini-2.0-flash-lite",
    summarize: "gemini-2.0-flash-lite"
  },
  openai: {
    chat: "gpt-4o-mini",
    suggestion: "gpt-4o-mini",
    summarize: "gpt-4o-mini"
  }
};

function normalizeProvider(value: string | undefined): AiProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "gemini" || normalized === "google") return "gemini";
  if (normalized === "openai" || normalized === "chatgpt" || normalized === "gpt") return "openai";
  return null;
}

function providerFromApiKey(): AiProvider | null {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (hasGemini && !hasOpenAi) return "gemini";
  if (hasOpenAi && !hasGemini) return "openai";
  if (hasGemini && hasOpenAi) return "gemini";
  return null;
}

export function resolveAiProvider(): AiProvider | null {
  const explicit = normalizeProvider(process.env[PROVIDER_ENV]);
  if (explicit) {
    if (explicit === "gemini" && process.env.GEMINI_API_KEY?.trim()) return "gemini";
    if (explicit === "openai" && process.env.OPENAI_API_KEY?.trim()) return "openai";
    return null;
  }

  return providerFromApiKey();
}

export function requireAiProvider(): AiProvider {
  const provider = resolveAiProvider();
  if (!provider) throw new AiNotConfiguredError();
  return provider;
}

export function isAiConfigured(): boolean {
  return resolveAiProvider() !== null;
}

export function resolveModel(
  provider: AiProvider,
  purpose: "chat" | "suggestion" | "summarize",
  envModel?: string
): string {
  const trimmed = envModel?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_MODELS[provider][purpose];
}
