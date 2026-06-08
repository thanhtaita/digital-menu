import type { AiChatRequest, AiCompletionResult, AiGenerateRequest } from "../types.js";

type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
  error?: { message?: string };
};

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return apiKey;
}

async function callOpenAi(body: Record<string, unknown>): Promise<OpenAiChatResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as OpenAiChatResponse;
  if (!response.ok) {
    const message = payload.error?.message ?? `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function buildMessages(systemPrompt: string, userPrompt: string): OpenAiMessage[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

export async function openAiGenerateText(request: AiGenerateRequest): Promise<AiCompletionResult> {
  const payload = await callOpenAi({
    model: request.model,
    messages: buildMessages(request.systemPrompt, request.userPrompt),
    temperature: request.temperature,
    max_tokens: request.maxOutputTokens
  });

  return {
    text: payload.choices?.[0]?.message?.content?.trim() ?? "",
    tokensUsed: payload.usage?.total_tokens ?? 0,
    model: request.model,
    provider: "openai"
  };
}

export async function openAiChat(request: AiChatRequest): Promise<AiCompletionResult> {
  const messages: OpenAiMessage[] = [{ role: "system", content: request.systemPrompt }];

  for (const message of request.history) {
    messages.push({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    });
  }

  messages.push({ role: "user", content: request.userMessage });

  const payload = await callOpenAi({
    model: request.model,
    messages,
    temperature: request.temperature,
    max_tokens: request.maxOutputTokens,
    ...(request.jsonMode ? { response_format: { type: "json_object" } } : {})
  });

  return {
    text: payload.choices?.[0]?.message?.content?.trim() ?? "",
    tokensUsed: payload.usage?.total_tokens ?? 0,
    model: request.model,
    provider: "openai"
  };
}
