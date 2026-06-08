import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiChatRequest, AiCompletionResult, AiGenerateRequest } from "../types.js";

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(apiKey);
}

export async function geminiGenerateText(request: AiGenerateRequest): Promise<AiCompletionResult> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: request.model,
    systemInstruction: request.systemPrompt,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens
    }
  });

  const result = await model.generateContent(request.userPrompt);
  return {
    text: result.response.text(),
    tokensUsed: result.response.usageMetadata?.totalTokenCount ?? 0,
    model: request.model,
    provider: "gemini"
  };
}

export async function geminiChat(request: AiChatRequest): Promise<AiCompletionResult> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: request.model,
    systemInstruction: request.systemPrompt,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      ...(request.jsonMode ? { responseMimeType: "application/json" } : {})
    }
  });

  const history = request.history.map((message) => ({
    role: message.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: message.content }]
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(request.userMessage);

  return {
    text: result.response.text(),
    tokensUsed: result.response.usageMetadata?.totalTokenCount ?? 0,
    model: request.model,
    provider: "gemini"
  };
}
