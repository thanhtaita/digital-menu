import { afterEach, describe, expect, it } from "vitest";
import { AiNotConfiguredError } from "../lib/ai/types.js";
import {
  isAiConfigured,
  requireAiProvider,
  resolveAiProvider,
  resolveModel
} from "../lib/ai/config.js";

const ENV_KEYS = ["AI_PROVIDER", "GEMINI_API_KEY", "OPENAI_API_KEY"] as const;

function clearAiEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("AI provider config", () => {
  afterEach(() => {
    clearAiEnv();
  });

  it("returns null when no provider keys are set", () => {
    clearAiEnv();
    expect(resolveAiProvider()).toBeNull();
    expect(isAiConfigured()).toBe(false);
    expect(() => requireAiProvider()).toThrow(AiNotConfiguredError);
  });

  it("auto-selects gemini when only GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    expect(resolveAiProvider()).toBe("gemini");
  });

  it("auto-selects openai when only OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    expect(resolveAiProvider()).toBe("openai");
  });

  it("prefers gemini when both keys are set and AI_PROVIDER is unset", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";
    expect(resolveAiProvider()).toBe("gemini");
  });

  it("honors AI_PROVIDER=openai when OPENAI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.AI_PROVIDER = "openai";
    expect(resolveAiProvider()).toBe("openai");
  });

  it("accepts chatgpt alias for openai", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.AI_PROVIDER = "chatgpt";
    expect(resolveAiProvider()).toBe("openai");
  });

  it("uses provider-specific default models", () => {
    expect(resolveModel("gemini", "chat")).toBe("gemini-2.0-flash");
    expect(resolveModel("openai", "suggestion")).toBe("gpt-4o-mini");
    expect(resolveModel("openai", "chat", "gpt-4.1")).toBe("gpt-4.1");
  });
});
