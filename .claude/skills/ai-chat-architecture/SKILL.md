---
name: ai-chat-architecture
description: Full design of the AI chat dish-recommendation feature - provider abstraction, session/summarization model, SSE streaming, and debug logging. Use when working on apps/api/src/lib/ai/, apps/api/src/services/ai-chat.ts, apps/api/src/routes/ai-chat.ts, or the diner-app chat page.
---

# AI chat recommendation architecture

Status: implemented. This is the canonical design reference for the feature (formerly `docs/features/260624_ai-chat-dish-recommendation.md` + `260624_ai-chat-streaming.md`, now merged here).

## Feature overview

From a restaurant page, a diner opens the **AI Picks** chat at `/r/[slug]/chat`, asks natural-language questions ("What's light and vegetarian?"), and gets a conversational reply plus up to 5 dish recommendation cards with a short reason each.

**Terminology**: one product **message** = one full **exchange** (diner question + assistant reply) = **two DB rows** (`user` + `assistant`).

Key behaviors:
- Context is scoped **per user × restaurant** - conversations at different restaurants are independent.
- Conversations **persist across visits**.
- **Batch summarization** (10 exchanges at a time) + a **10-exchange recent window** bound LLM context size.
- Hard restrictions become explicit "never recommend" instructions in the system prompt.
- The assistant is instructed to only recommend dishes on the published menu.
- Follow-ups work because prior assistant turns replay their stored `recommendations` into LLM history.
- Diners can like recommendation cards; liked dish names bias future prompts.

Out of scope: admin-configurable prompts per restaurant, embedding-based ranking inside chat (that's the separate pgvector system - see `CLAUDE.md` § System design), rate limiting (not implemented anywhere yet), production log shipping.

## Architecture

```
Diner App (Next.js 15)
  /r/[slug]/chat/page.tsx
    POST   /api/v1/public/restaurants/:slug/chat          (JSON, blocking)
    POST   /api/v1/public/restaurants/:slug/chat/stream    (SSE, used by the UI)
    GET    /api/v1/public/restaurants/:slug/chat/history
    DELETE /api/v1/public/restaurants/:slug/chat
    POST   /api/v1/public/restaurants/:slug/chat/like
        │ session cookie (requireAuth)
        ▼
API (Fastify)
  routes/ai-chat.ts      — HTTP handlers, SSE hijack, error mapping
  services/ai-chat.ts    — orchestration, prompt building, persistence
  lib/ai/                — provider abstraction (Gemini / OpenAI)
  lib/ai-chat-logger.ts  — JSON file logs (dev/debug)
        │                              │
        ▼                              ▼
   PostgreSQL                   Gemini / OpenAI API
   ai_chat_sessions             (chat + summarize models)
   ai_chat_messages
   restaurants, menus, dishes,
   user_preferences, user_restrictions
```

### Request lifecycle (`POST …/chat` or `…/chat/stream`)

1. Authenticate diner; resolve active restaurant by slug.
2. Validate body with `sendChatMessageSchema` (`message`, 1-1000 chars, trimmed).
3. Concurrent DB reads (`Promise.all`): `fetchMenuContext` (published menu → text block), `fetchUserContext` (preference text + restrictions), `getOrCreateSession` (one row per `(userId, restaurantId)`). All three call `db.select()` before their first `await`, so **mock call order in tests differs from source reading order** - see `setupProcessChatMocks` in `ai-chat.service.test.ts`.
4. Load the last 10 exchanges (20 DB rows); enrich assistant turns with their stored `recommendations`.
5. Build the system prompt (menu, profile, summary, liked dishes, JSON output rules).
6. Call the provider's `chat()` or `chatStream()` with `jsonMode: true`.
7. Parse JSON → `{ message, recommendations[] }`; if `JSON.parse` fails (e.g. a safety refusal as plain text), the raw text becomes `message` and `recommendations` is `[]`.
8. Persist user + assistant rows; write a debug log entry.
9. Fire-and-forget `summarizeSession` (batch summarization) - not awaited by the request.
10. Return the JSON body, or SSE events (`chunk`/`done`/`error`) on the streaming path.

## Data model

### `ai_chat_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | FK → `users`, cascade | |
| `restaurant_id` | FK → `restaurants`, cascade | |
| `conversation_summary` | text, nullable | rolling summary of batches removed from `ai_chat_messages` |
| `liked_dish_names` | jsonb `string[]` | injected into the system prompt |
| `created_at`, `updated_at` | timestamp | |

Unique index: `(user_id, restaurant_id)`.

### `ai_chat_messages`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `session_id` | FK → `ai_chat_sessions`, cascade | |
| `role` | text | `"user"` \| `"assistant"` |
| `content` | text | conversational text (UI + LLM) |
| `recommendations` | jsonb, nullable | `[{ dishName, reason }]` on assistant turns |
| `created_at` | timestamp | |

Deleting a user or restaurant cascades to sessions and messages.

| Data | UI (`GET …/history`) | LLM (`processChat`) |
|---|---|---|
| Recent unsummarized exchanges | full list from DB | last 10 exchanges (20 rows) as `history` |
| Summarized older exchanges | not returned as rows | folded into `conversation_summary` in the system prompt |
| `recommendations` | on assistant messages | appended to assistant `content` in `history` |

## API contract

Base prefix: `/api/v1/public`. All routes require session auth (`requireAuth`).

**`POST /restaurants/:slug/chat`** - body `{ "message": string }` → `{ message, recommendations: [{dishName, reason}], sessionId }`. Errors: `401` unauth, `404` restaurant not found/inactive, `422` validation, `503 AI_NOT_CONFIGURED`, `502 AI_ERROR`.

**`POST /restaurants/:slug/chat/stream`** - SSE, `text/event-stream`, uses `reply.hijack()`. Events (`data: {json}\n\n`):

| Event | Shape |
|---|---|
| `chunk` | `{ "type": "chunk", "text": "partial message…" }` (non-empty only) |
| `done` | `{ "type": "done", "message", "recommendations", "sessionId" }` (sent once, after DB write succeeds) |
| `error` | `{ "type": "error", "code": "AI_NOT_CONFIGURED" \| "AI_ERROR" }` (client also handles a local `NETWORK_ERROR` if fetch throws before connecting) |

**`GET /restaurants/:slug/chat/history`** → `{ restaurantName, messages: [{id, role, content, createdAt, recommendations}], summary }`. `messages` is `[]` with no session; `summary` is `null` until the first summarization batch.

**`DELETE /restaurants/:slug/chat`** → `204`, deletes the session (messages cascade).

**`POST /restaurants/:slug/chat/like`** - body `{ dishName, liked }` → `204`, updates `liked_dish_names`.

## Service layer (`apps/api/src/services/ai-chat.ts`)

| Function | Purpose |
|---|---|
| `processChat({userId, restaurantId, message})` | main entry: context → LLM → persist → summarize |
| `processChatStream(...)` | async generator: streams partial text, then persists |
| `getChatHistory({userId, restaurantId})` | restaurant name, messages, summary |
| `clearChatSession({userId, restaurantId})` | delete session row |
| `likeDishInSession({userId, restaurantId, dishName, liked})` | toggle liked dishes |
| `summarizeSession(sessionId, currentSummary)` | batch summarization loop |
| `buildSystemPrompt(...)` / `buildSummarizePrompt(...)` | pure prompt builders |
| `formatMessageForChatHistory` / `formatAssistantHistoryContent` | history enrichment |
| `shouldRunBatchSummarization` / `selectBatchMessagesForSummarization` / `countCompleteExchanges` | batch helpers |
| `extractPartialMessageFromJson` | regex-based partial-JSON extraction for streaming |

Internal helpers: `fetchMenuContext` (published menus → sections → available dishes → text block), `fetchUserContext` (preferences + restrictions, block vs warn), `getOrCreateSession`.

## Context & batch summarization

```
RECENT_EXCHANGES_WINDOW = 10   // product "messages" = user+assistant pairs
RECENT_MESSAGES_WINDOW  = 20   // DB rows (= RECENT_EXCHANGES_WINDOW × 2)
```

Every turn, the LLM receives: `systemPrompt = MENU + USER PROFILE + summary + liked dishes + JSON rules`, `history = last 10 exchanges`, `userMessage = current input`.

After each successful chat, `summarizeSession` runs fire-and-forget:

```
while countCompleteExchanges(dbRowCount) > RECENT_EXCHANGES_WINDOW:
  batch = oldest 20 rows (10 exchanges)
  newSummary = LLM(previousSummary + batch transcript)
  UPDATE conversation_summary
  DELETE batch rows
  re-fetch; loop if still > 10 complete exchanges
```

`countCompleteExchanges(n) = floor(n / 2)` - a trailing lone `user` row doesn't count as complete. Example progression: exchanges 1-10 → no summary, all in `history`; exchange 11 → batch 1 summarizes 1-10, keeps 11; exchanges 12-20 → tail grows, `summary₁` fixed; exchange 21 → batch 2 merges `summary₁` + 11-20 → `summary₂`; exchange 31 → batch 3, and so on.

**Follow-up continuity**: assistant `content` alone can be vague ("Here are some light options!"). When building `history`, stored `recommendations` are appended as a "Recommended dishes: - X — reason" block so follow-ups like "which of those is vegan?" work without changing the UI message shape.

## System prompt (`buildSystemPrompt`)

Order: greeting + restaurant name → `MENU:` (section → dish name/price/description) → `USER PROFILE:` (preferences, hard restrictions = never recommend, dislikes = avoid if possible) → liked dishes (when non-empty) → `PREVIOUS CONVERSATION CONTEXT:` (summary, when present) → guidelines (only menu dishes, respect restrictions, be warm/concise) → mandatory JSON-only output instruction: `{"message":"…","recommendations":[{"dishName":"…","reason":"…"}]}`, 1-5 recommendations or `[]`.

## AI provider layer (`apps/api/src/lib/ai/`)

| Module | Role |
|---|---|
| `config.ts` | `resolveAiProvider`, `requireAiProvider`, `resolveModel` |
| `types.ts` | `AiChatRequest`, `AiCompletionResult`, `AiNotConfiguredError` |
| `channels/gemini.ts` | Gemini SDK - `chat`, `chatStream` (`sendMessageStream`), `generateText` |
| `channels/openai.ts` | raw-fetch OpenAI REST - `chat`, `chatStream` (manual SSE parsing), `generateText` |
| `index.ts` | provider dispatch via a `channelFor()` lookup |

Provider selection: `AI_PROVIDER` env var (`gemini`/`google` or `openai`/`chatgpt`/`gpt`), else auto-detect from whichever API key is set (Gemini wins if both are set). Per-purpose model defaults (`chat`, `suggestion`, `summarize`):

| Purpose | Env var | Gemini default | OpenAI default |
|---|---|---|---|
| Chat | `AI_CHAT_MODEL` | `gemini-2.0-flash` | `gpt-4o-mini` |
| Summarize | `AI_CHAT_SUMMARIZE_MODEL` | `gemini-2.0-flash-lite` | `gpt-4o-mini` |

Gemini history role mapping: DB `"assistant"` → API `"model"`. Chat generation params: `temperature: 0.7`, `maxOutputTokens: 1000`, `jsonMode: true`.

### Streaming specifics

- **`reply.hijack()` instead of a `PassThrough` stream**: Fastify's `reply.send(stream)` can buffer a `PassThrough` until it ends, which would defeat streaming entirely. `reply.hijack()` + `reply.raw.write()` writes each SSE event straight to the socket the moment it's yielded. CORS headers set by `@fastify/cors` live in Fastify's internal reply map and aren't auto-applied to `reply.raw` after hijacking - they're copied manually via `reply.getHeaders()` before hijacking.
- **Progressive JSON extraction, not plain-text mode**: `jsonMode: true` is kept (reliable recommendation parsing), so the model streams a JSON envelope, not prose. `extractPartialMessageFromJson` uses `/"message"\s*:\s*"((?:[^"\\]|\\.)*)/ ` against the *partial* accumulated JSON, handling `\"` escapes, and the service diffs against `lastExtractedLength` to yield only new characters. If a provider buffers the whole JSON before yielding (common with Gemini JSON mode), the extraction still works - it just emits one large `chunk` instead of incremental words.
- **`done` is yielded after the DB insert succeeds**, not before - so a client's `onDone` is a reliable signal the message is persisted, and a subsequent `GET …/history` will find it.
- Gemini: `chat.sendMessageStream(userMessage)`, iterate `.stream`, yield each chunk's `.text()`.
- OpenAI: `stream: true` on chat completions; `openAiChatStream` reads the `ReadableStream` body, splits on `\n`, extracts `choices[0].delta.content` per line, stops on `data: [DONE]`. `response_format: { type: "json_object" }` is preserved.
- Known limitation: no word-by-word effect when a provider buffers the full JSON; no streaming for the summarize call (it's fire-and-forget, non-streaming, which is fine for a background task); no partial-result preservation if the LLM errors mid-stream (client just removes the partial bubble on an `error` event).

## Debug logging (`apps/api/src/lib/ai-chat-logger.ts`)

Every chat and summarize call writes one JSON file to `apps/api/logs/ai-chat/YYYY-MM-DD/HH-mm-ss-{id}.json` (gitignored), containing the full request (prompt, history, params), response (raw, parsed, tokens), context, timing, and error if any. Toggle with `AI_CHAT_LOG_ENABLED` (default `true`); path override `AI_CHAT_LOG_DIR` (default `apps/api/logs/ai-chat`). Fire-and-forget - failures are `console.warn` only and never break the request.

## Frontend (`apps/diner-app/src/app/r/[slug]/chat/page.tsx`)

Client component, gated by `useAuth()` (redirects to `/login`). Loads chat history (`apiGetChatHistory`) and the restaurant's public menu (`apiGetPublicMenu`) in parallel on mount.

Send flow (streaming, via `apiSendChatMessageStream` in `apps/diner-app/src/lib/api-client.ts`):
1. Append an optimistic user bubble + a streaming assistant bubble (`content: "", isStreaming: true` → renders three bouncing dots).
2. `onChunk(text)` → append to the assistant bubble; dots replaced by text + blinking cursor.
3. `onDone(result)` → replace content with the authoritative `message`, render recommendation cards, clear streaming/optimistic flags.
4. `onError(code)` → remove both bubbles, show an error banner.

Other client functions: `apiSendChatMessage` (non-stream, still available), `apiClearChat`, `apiLikeChatDish`. UI: clicking a recommendation card that case-insensitive-exact-matches a real menu dish name opens a bottom-sheet `DishSheet` (image/gradient, ingredients with allergen highlighting, price, availability); a heart button optimistically toggles like state via `apiLikeDishRecommendation`; "Clear" prompts a `confirm()` then calls `apiClearChat`; empty-state prompt chips ("What's popular?", "Something light", "I'm feeling adventurous") send immediately on click.

## Shared types (`packages/shared/src/ai-chat.ts`)

`sendChatMessageSchema` (message 1-1000 chars, trimmed), `chatRecommendationSchema` (`{dishName, reason}`), `chatResponseSchema`, `chatHistoryResponseSchema`, `chatMessageResponseSchema`.

## Configuration

```env
AI_PROVIDER=gemini|openai          # optional; auto-detect from keys
GEMINI_API_KEY=...
OPENAI_API_KEY=...
AI_CHAT_MODEL=...
AI_CHAT_SUMMARIZE_MODEL=...
AI_CHAT_LOG_ENABLED=true
AI_CHAT_LOG_DIR=apps/api/logs/ai-chat
```

## Tests

| File | Coverage |
|---|---|
| `apps/api/src/__tests__/ai-chat.service.test.ts` | `buildSystemPrompt`, history formatting, `processChat`, batch helpers |
| `apps/api/src/__tests__/ai-chat-summarization.test.ts` | exchange-based batch boundaries, `summarizeSession`, prompts |
| `apps/api/src/__tests__/ai-chat.routes.test.ts` | HTTP status codes via Fastify `inject` |
| `apps/api/src/__tests__/ai-chat-logger.test.ts` | log file shape |
| `apps/diner-app/src/__tests__/chat-page.test.tsx` | UI: auth, history, send, recommendations, clear |

Mocking note: `processChat` issues six ordered `db.select` calls (from the three `Promise.all` branches); tests use `setupProcessChatMocks` with explicit call ordering.

## Design decisions

- **LLM over an in-house pipeline for now** - Gemini/OpenAI give zero-shot recommendations from menu text + preferences today; the pgvector embedding pipeline can complement or replace this later (see `CLAUDE.md` § System design for how the two currently coexist).
- **One session per (user, restaurant)** for continuity; summarization keeps context bounded.
- **Batch summarization (10 exchanges)** instead of incremental one-row summaries; aligned with the recent window size.
- **Summary + 10-exchange window**: verbatim tail for follow-ups, compressed summary for older context.
- **Recommendations replayed in history** so "which of those is vegan?" works without changing the message shape.
- **Fire-and-forget summarization** keeps it off the request's critical path; failures just get logged.
- **JSON mode + parse fallback**: reliable cards normally, graceful degradation on refusals.
- **Local file logs**: full prompts available for dev tuning without bloating the DB.
- **SSE streaming**: partial assistant text shown while the full JSON response is still arriving.

## Known limitations & future work

- No rate limiting on chat endpoints.
- Menu context sent to the LLM is plain text, so dish-name typos in recommendations are possible.
- Summarized exchanges disappear from `GET …/history` entirely - only `summary` represents them (no "earlier conversation summarized" UI hint yet).
- Malformed stream chunks are ignored client-side.
