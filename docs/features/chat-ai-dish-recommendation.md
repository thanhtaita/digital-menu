# AI Chat Dish Recommendation

A conversational recommendation feature that lets diners ask a Gemini-powered assistant for dish suggestions based on the restaurant's live menu, the diner's personal preferences and dietary restrictions, and the history of prior conversations with that restaurant.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Service Layer](#5-service-layer)
6. [Context & Token Management](#6-context--token-management)
7. [System Prompt Design](#7-system-prompt-design)
8. [Frontend (Diner App)](#8-frontend-diner-app)
9. [Shared Types & Validation](#9-shared-types--validation)
10. [Configuration](#10-configuration)
11. [Tests](#11-tests)
12. [Design Decisions](#12-design-decisions)

---

## 1. Feature Overview

When a diner visits a restaurant's page they can open an **AI Picks** tab that opens a dedicated chat interface. They type a natural-language question ("What's light and vegetarian?") and the assistant replies with a conversational message and up to 5 dish recommendation cards, each with a reason tailored to the user's preferences.

Key behaviours:
- Context is **scoped per user × restaurant**: conversations with Sushi Bar and Pasta Palace are independent.
- Conversations **persist across sessions** — reopening the page reloads the history.
- A **rolling-window + summarisation** strategy prevents the LLM context window from growing unboundedly.
- The LLM is **never given raw ingredients or allergies in ambiguous form** — hard restrictions are formatted explicitly as "never recommend" instructions in the system prompt.
- The assistant is instructed to **only recommend dishes that exist on the menu**.

---

## 2. Architecture

```
Diner App (Next.js 15)                 API (Fastify)                    External
────────────────────────               ────────────────────────────     ─────────────
/r/[slug]/chat/page.tsx
  │
  │  POST /restaurants/:slug/chat
  │  GET  /restaurants/:slug/chat/history
  │  DELETE /restaurants/:slug/chat
  │─────────────────────────────────>  routes/ai-chat.ts
                                         │
                                         │  requireAuth middleware
                                         │  resolveRestaurant(slug)
                                         │
                                         │  services/ai-chat.ts
                                         │    ├─ fetchMenuContext()    ──> DB (restaurants, menus,
                                         │    │                             menuSections, dishes)
                                         │    ├─ fetchUserContext()    ──> DB (userPreferences,
                                         │    │                             userRestrictions,
                                         │    │                             ingredients)
                                         │    ├─ getOrCreateSession()  ──> DB (ai_chat_sessions)
                                         │    │
                                         │    │  [ all three run concurrently via Promise.all ]
                                         │    │
                                         │    ├─ fetch recentMessages  ──> DB (ai_chat_messages)
                                         │    ├─ buildSystemPrompt()
                                         │    ├─ GoogleGenerativeAI    ──> Google Gemini API
                                         │    ├─ persist user+assistant messages
                                         │    └─ summarizeSession()    (fire-and-forget)
                                         │
                                         └──────────────────────────>  JSON response to client
```

**Data flow for a single send:**

1. Client sends `POST /restaurants/sushi-bar/chat` with `{ message: "..." }`.
2. Route handler authenticates the request and resolves the restaurant by slug.
3. `processChat` launches three DB queries concurrently:
   - restaurant name + full menu text (section → dishes)
   - user preference text + dietary restrictions
   - existing session row (or inserts a new one)
4. The last N messages for that session are fetched (rolling window).
5. A system prompt is assembled and a Gemini chat session is started with the recent history.
6. The user's message is sent to Gemini; the JSON response is parsed.
7. Both the user message and assistant reply are persisted to `ai_chat_messages`.
8. A fire-and-forget `summarizeSession` call is triggered to keep message count under control.
9. The parsed response (`message`, `recommendations[]`, `sessionId`) is returned to the client.

---

## 3. Database Schema

### Tables

```sql
-- One row per (user, restaurant) pair.
CREATE TABLE ai_chat_sessions (
  id                   serial       PRIMARY KEY,
  user_id              integer      NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  restaurant_id        integer      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  conversation_summary text,        -- rolling summary written by gemini-2.0-flash-lite
  created_at           timestamp    NOT NULL DEFAULT now(),
  updated_at           timestamp    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_chat_sessions_user_restaurant_unique
  ON ai_chat_sessions (user_id, restaurant_id);

-- All individual turn messages for a session.
CREATE TABLE ai_chat_messages (
  id         serial    PRIMARY KEY,
  session_id integer   NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role       text      NOT NULL,   -- "user" | "assistant"
  content    text      NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_messages_session_id_idx
  ON ai_chat_messages (session_id);
```

**Cascade behaviour:** Deleting a `users` or `restaurants` row automatically deletes all related sessions and messages.

**Migration file:** `packages/db/drizzle/0008_ai_chat.sql`  
**Drizzle schema:** `packages/db/src/schema/schema.ts` — `aiChatSessions`, `aiChatMessages`

---

## 4. API Endpoints

All three routes are registered at the `/api/v1/public` prefix and require a valid session cookie (enforced by `requireAuth`).

### `POST /api/v1/public/restaurants/:slug/chat`

Send a chat message and receive an AI response.

**Auth:** required  
**Params:** `slug` — restaurant URL slug

**Request body:**
```json
{ "message": "What's light and vegetarian?" }
```
- `message`: string, 1–1000 characters, trimmed (Zod)

**Response `200`:**
```json
{
  "message": "I'd suggest the Caprese Salad — fresh and perfect for a light meal.",
  "recommendations": [
    { "dishName": "Caprese Salad", "reason": "Light, vegetarian, and on the menu" }
  ],
  "sessionId": 42
}
```

**Error responses:**

| Status | Code | Meaning |
|--------|------|---------|
| 401 | — | Not authenticated |
| 404 | — | Restaurant slug not found or inactive |
| 422 | — | Message validation failed |
| 503 | `AI_NOT_CONFIGURED` | `GEMINI_API_KEY` not set |
| 502 | `AI_ERROR` | Gemini API call failed |

---

### `GET /api/v1/public/restaurants/:slug/chat/history`

Retrieve the full persisted conversation for the current user at this restaurant.

**Auth:** required

**Response `200`:**
```json
{
  "restaurantName": "Sushi Bar",
  "messages": [
    { "id": 1, "role": "user",      "content": "...", "createdAt": "2026-06-07T10:00:00.000Z" },
    { "id": 2, "role": "assistant", "content": "...", "createdAt": "2026-06-07T10:00:01.000Z" }
  ],
  "summary": "User prefers light, vegetarian options and asked about popular dishes."
}
```
- `messages` is an empty array when no session exists yet.
- `summary` is `null` until the auto-summarisation threshold is crossed.

---

### `DELETE /api/v1/public/restaurants/:slug/chat`

Delete the user's session (and all messages) for this restaurant.

**Auth:** required  
**Response:** `204 No Content`

Deletion cascades from `ai_chat_sessions` → `ai_chat_messages` at the database level.

---

## 5. Service Layer

**File:** `apps/api/src/services/ai-chat.ts`

### Exported functions

| Function | Purpose |
|----------|---------|
| `processChat({ userId, restaurantId, message })` | Main entry point — fetches context, calls Gemini, persists messages |
| `getChatHistory({ userId, restaurantId })` | Returns restaurant name, all messages, and current summary |
| `clearChatSession({ userId, restaurantId })` | Deletes the session row |
| `buildSystemPrompt(name, menuText, userContext, summary)` | Pure function — assembles the system prompt string |

### Internal helpers

| Helper | What it does |
|--------|-------------|
| `fetchMenuContext(restaurantId)` | Joins menus → sections → dishes for published menus with available dishes; builds a plain-text menu block |
| `fetchUserContext(userId)` | Fetches `userPreferences` and `userRestrictions`; labels hard blocks vs soft dislikes |
| `getOrCreateSession(userId, restaurantId)` | Upsert-style: returns the existing session or inserts a new one |
| `summarizeSession(sessionId, currentSummary)` | Fire-and-forget: counts all messages and, if above threshold, asks Gemini to produce a compact summary, stores it, then deletes the summarised messages |

### Concurrency

`fetchMenuContext`, `fetchUserContext`, and `getOrCreateSession` are launched with `Promise.all` so all three DB round-trips happen in parallel:

```typescript
const [{ restaurantName, menuText }, userContext, session] = await Promise.all([
  fetchMenuContext(restaurantId),
  fetchUserContext(userId),
  getOrCreateSession(userId, restaurantId),
]);
```

This is important to understand when mocking in tests — all three functions call `db.select()` synchronously before their first `await`, so mock call order differs from source-code reading order (see `setupProcessChatMocks` comments in the test file).

### JSON fallback

Gemini is configured with `responseMimeType: "application/json"` and instructed to return a strict JSON shape. If `JSON.parse` still fails (e.g. a model safety refusal in plain text), the raw text is used as the `message` and `recommendations` is set to `[]`.

---

## 6. Context & Token Management

The feature must stay within Gemini's context window even for users who have had many conversations at the same restaurant.

### Rolling message window

Only the **last 10 messages** (`RECENT_MESSAGES_WINDOW = 10`) are sent to Gemini as `history`. Older messages are either summarised or deleted. The full message list is stored in the database but only the tail is sent to the LLM.

```
DB (all messages)     LLM context
──────────────        ───────────────────────────────────
msg 1  [summarised]   systemPrompt (menu + user + summary)
msg 2  [summarised]   ──────────────────────────────────
msg 3  [summarised]   history[0]  oldest of last 10
msg 4  [summarised]   history[1]
…                     …
msg 14                history[8]
msg 15 (current)  ──> history[9]  newest retained msg
                      ──────────────────────────────────
                      sendMessage(userInput)
```

### Auto-summarisation

After each successful `processChat`, `summarizeSession` runs **fire-and-forget** (errors are logged as warnings, not propagated):

```
total message count > SUMMARIZE_THRESHOLD (20)?
   yes → take all messages except the last 10
         → ask gemini-2.0-flash-lite to summarise them into 2–4 sentences
         → write summary to ai_chat_sessions.conversation_summary
         → delete the summarised message rows from ai_chat_messages
   no  → return early (no-op)
```

The summary is included in the system prompt on the next request under a `PREVIOUS CONVERSATION CONTEXT` section, so the model has continuity without the full message history.

**Model used for summarisation:** `gemini-2.0-flash-lite` (cheaper/faster than the main model).  
**Model used for chat:** env `AI_CHAT_MODEL` (default: `gemini-2.0-flash`).

---

## 7. System Prompt Design

`buildSystemPrompt` assembles a single string in this order:

```
You are a friendly food recommendation assistant for {restaurantName}.

MENU:
[Section]
  • Dish name ($price) — description
  • …

USER PROFILE:
Preferences: {free-text preference}
Hard restrictions (never recommend): {ingredient/diet list}
Dislikes (avoid if possible): {ingredient/diet list}

PREVIOUS CONVERSATION CONTEXT:     ← only present when a summary exists
{summary text}

Guidelines:
- Only recommend dishes that appear in the MENU above — never invent dishes
- Respect hard restrictions absolutely; avoid dislikes when possible
- Be warm, concise, and conversational
- When recommending, briefly explain why it fits the user

Respond ONLY with valid JSON — no markdown, no extra text:
{"message":"...","recommendations":[{"dishName":"...","reason":"..."}]}
Include 1–5 recommendations when relevant; use [] if no dish suggestions are needed.
```

**Key constraints baked into the prompt:**
- The model is forbidden from inventing dishes not on the menu.
- Hard dietary blocks (allergy severity `block`) are in a "never recommend" list.
- Soft dislikes (severity `warn`) are in an "avoid if possible" list.
- The response must be JSON — `responseMimeType: "application/json"` enforces this at the API level too.

---

## 8. Frontend (Diner App)

**File:** `apps/diner-app/src/app/r/[slug]/chat/page.tsx`  
**Route:** `/r/[slug]/chat`  
**Entry point from menu:** "AI Picks" tab on the restaurant menu page.

### State

| State | Type | Purpose |
|-------|------|---------|
| `messages` | `LocalMessage[]` | Rendered conversation (persisted + in-flight) |
| `history` | `ChatHistory \| null` | Raw history response from API |
| `input` | `string` | Controlled input field value |
| `sending` | `boolean` | True while awaiting API response |
| `loadingHistory` | `boolean` | True until the history fetch resolves |
| `error` | `string \| null` | Displayed error banner |

`LocalMessage` extends `ChatMessage` with two optional fields:
- `recommendations?: ChatRecommendation[]` — attached to assistant messages
- `isOptimistic?: boolean` — true while the message is not yet confirmed by the server

### Send flow

```
user submits form
  │
  ├─ setInput("")
  ├─ setSending(true)
  ├─ append optimistic user message (isOptimistic: true, id: -Date.now())
  │
  await apiSendChatMessage(slug, text)
  │
  ├─ [success]
  │    replace optimistic message with confirmed version (isOptimistic: false)
  │    append assistant message (with recommendations if any)
  │    focus input
  │
  └─ [error]
       remove optimistic message
       setError("Failed to send message. Please try again.")
  │
  setSending(false)
```

### Conditional rendering

| Condition | What renders |
|-----------|-------------|
| `loading \|\| loadingHistory` | Full-page "Loading…" |
| `!user` (after auth resolves) | `null` (redirect to `/login` already triggered) |
| `messages.length === 0 && !sending` | Empty state: welcome text + 3 starter chips |
| `sending` | "Thinking…" bubble at the bottom |
| assistant message with `recommendations` | Amber-bordered dish cards below the message bubble |

### API client functions

Defined in `apps/diner-app/src/lib/api-client.ts`:

```typescript
apiGetChatHistory(slug: string): Promise<ChatHistory>
apiSendChatMessage(slug: string, message: string): Promise<ChatSendResponse>
apiClearChat(slug: string): Promise<void>
```

---

## 9. Shared Types & Validation

**File:** `packages/shared/src/ai-chat.ts`

| Export | Type | Description |
|--------|------|-------------|
| `sendChatMessageSchema` | Zod | Validates the incoming request body (min 1, max 1000, trimmed) |
| `chatRecommendationSchema` | Zod | `{ dishName: string, reason: string }` |
| `chatMessageResponseSchema` | Zod | Single message in history response |
| `chatResponseSchema` | Zod | Full `POST /chat` response shape |
| `chatHistoryResponseSchema` | Zod | Full `GET /chat/history` response shape |
| `SendChatMessage` | TypeScript type | Inferred from `sendChatMessageSchema` |
| `ChatRecommendation` | TypeScript type | — |
| `ChatResponse` | TypeScript type | — |
| `ChatHistoryResponse` | TypeScript type | — |

The `sendChatMessageSchema` is used by the Fastify route for request validation. The remaining schemas are available for frontend validation if needed.

---

## 10. Configuration

| Environment variable | Default | Description |
|----------------------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required.** Google Gemini API key. Missing key → `503 AI_NOT_CONFIGURED`. |
| `AI_CHAT_MODEL` | `gemini-2.0-flash` | Gemini model used for the main chat response. |

Summarisation always uses `gemini-2.0-flash-lite` (hardcoded — it doesn't need to match the chat model).

Gemini generation parameters:
- `temperature: 0.7` — balanced creativity vs determinism
- `maxOutputTokens: 1000` — caps response length
- `responseMimeType: "application/json"` — forces structured output

---

## 11. Tests

### API — service unit tests

**File:** `apps/api/src/__tests__/ai-chat.service.test.ts`  
**Runner:** Vitest (via `pnpm --filter @digital-menu/api test`)  
**Coverage:** 19 tests

Tests are organised by function:

- **`buildSystemPrompt`** (7 tests) — pure function; checks restaurant name, menu text, user context, summary inclusion/exclusion, JSON instruction, and the "only recommend dishes on the menu" constraint.
- **`getChatHistory`** (4 tests) — empty session, populated session with messages, ISO date mapping, fallback restaurant name.
- **`clearChatSession`** (1 test) — verifies `db.delete` is called.
- **`processChat`** (7 tests) — API key guard, full success path with JSON response, raw-text fallback, history role mapping (Gemini uses `"model"` not `"assistant"`).

**Key mocking patterns:**
- `db.select` / `db.insert` / `db.update` are mocked via a `dbChain<T>(data)` helper that returns a Drizzle-like chainable object which resolves to `data` when awaited.
- `GoogleGenerativeAI` is mocked with a regular `function()` (not arrow function) so `new GoogleGenerativeAI()` works.
- The six `db.select` calls inside `processChat` happen in a specific interleaved order due to `Promise.all`; the test helper `setupProcessChatMocks` documents and reproduces this order explicitly.
- A fallback `.mockReturnValue(dbChain([]))` is registered after the six specific calls to absorb the fire-and-forget `summarizeSession` check without crashing.

### API — route integration tests

**File:** `apps/api/src/__tests__/ai-chat.routes.test.ts`  
**Coverage:** 20 tests

Builds a minimal Fastify app with only `aiChatRoutes` registered, then uses Fastify's `inject` API for in-process HTTP calls. The service layer is fully mocked. Tests cover all three routes × all status codes (401, 404, 422, 503, 502, 200/204).

### Diner app — UI tests

**File:** `apps/diner-app/src/__tests__/chat-page.test.tsx`  
**Runner:** Vitest + jsdom + `@testing-library/react` v16 + `@testing-library/user-event` v14  
**Coverage:** 20 tests

All Next.js dependencies (`next/navigation`, `next/link`) and app dependencies (`auth-context`, `api-client`, `SiteHeader`) are fully mocked. Tests cover:

- Auth loading state, unauthenticated redirect, history-loading state
- `apiGetChatHistory` called with correct slug; restaurant name; existing messages; load error
- Empty state (welcome text + all 3 starter chips); chip click fills input
- Full send round-trip; correct API call args; recommendation cards rendered; error banner + optimistic message removal; send button disabled/enabled states
- Clear button visibility; confirm path; cancel path; clear error banner

---

## 12. Design Decisions

**Why a third-party LLM instead of an in-house ML pipeline?**  
The in-house embedding + ranking pipeline (see `plans/unified-recommendation-system.md`) requires training data and infrastructure not yet available. Gemini provides high-quality, zero-shot recommendations immediately using the menu text and user preferences as context, with no training step. The two approaches are not mutually exclusive — the in-house pipeline can be added later as a fallback ranking layer or replaced entirely if better signals are available.

**Why one session per (user, restaurant) instead of one session per visit?**  
Continuity. A diner who visited Sushi Bar three times and asked about vegetarian options each time should not have to re-explain their preferences. The rolling-window + summarisation strategy ensures the session can grow indefinitely without exceeding the LLM context limit.

**Why fire-and-forget summarisation?**  
Summarisation is a background maintenance task. Blocking the chat response on it would add latency on every message for the ~5% of cases where the threshold is crossed. Failures are logged as warnings and the worst case is a slightly oversized context on the next request — not a user-visible error.

**Why `responseMimeType: "application/json"` with a JSON fallback?**  
Gemini's JSON mode reliably produces parseable output in normal operation. The raw-text fallback exists for edge cases such as a model safety refusal, which is returned as plain text even with JSON mode enabled. Without the fallback the feature would break silently for users who triggered a refusal.

**Why map `"assistant"` → `"model"` in chat history?**  
Gemini's `startChat` API requires history entries to use `"user"` and `"model"` as role identifiers; it does not accept `"assistant"`. Messages are stored with the semantically clearer `"assistant"` value in the database and mapped to `"model"` at the point of constructing the LLM `history` array.
