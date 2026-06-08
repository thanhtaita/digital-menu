# API — implemented features

What **this service** exposes and enforces today. Canonical path list: root `IMPLEMENTED_ROUTES.md`. Planned but missing: `PROGRESS.md` + `TECH_PLAN.md`.

---

## Platform & auth

- **Health:** liveness-style `GET /health` under `/api/v1`.
- **CORS** with credentials; **cookies** for sessions.
- **Better Auth:** `POST` register/login, `POST` logout, `GET` me (`/api/v1/auth/*`).
- **Role-aware behavior** on ingredient and write routes (diner vs restaurant admin vs superadmin).

## File uploads (local dev)

- `**GET /uploads/...`** (not under `/api/v1`): static files from upload root (`UPLOAD_DIR` / `apps/api/uploads`).
- **Multipart** body size limits enforced on upload routes.
- **Dish gallery:** append image/video, reorder, delete (deletes DB row and local file when URL is under `/uploads/`).
- **Ingredient gallery:** same pattern for dictionary ingredients (with auth rules below).
- **Legacy single image** endpoints still update `image_url` while also supporting the newer `media` arrays.

## Restaurants & menu hierarchy

- **Restaurants:** list, create, get by id, patch (e.g. name, slug, description, logo, active flag).
- **Menus** (under restaurant): full CRUD; `**is_published`** drives public menu visibility.
- **Sections** (under menu): full CRUD including ordering concerns handled by API + client.
- **Dishes** (under section): full CRUD; list/detail responses include ordered `**media`**.
- **Dish translations:** `GET/PUT/DELETE .../dishes/:id/translations/:locale` — restaurant admin or superadmin; `PUT` upserts (creates or replaces); locale validated as BCP-47.
- **Dish ↔ ingredients:** list links for a dish, add an ingredient to a dish, remove a link.

## Ingredient dictionary

- **Search** `GET /ingredients?q=` — approved ingredients for everyone; logged-in restaurant staff also see **pending** rows they are allowed to see (e.g. requested by a restaurant they manage). Responses include ordered `**media`** (`image` | `video`).
- **Superadmin:** list all **pending** requests; **create** approved ingredient immediately; **approve** a pending row; **patch** (edit name/description/allergen); **delete** any ingredient with in-use conflict check.
- **Ingredient translations:** `GET/PUT/DELETE /ingredients/:id/translations/:locale` — **superadmin only**; same upsert/delete semantics as dish translations.
- **Restaurant admin:** **request** a new ingredient (creates **pending** for that restaurant); upload/reorder/delete **media** on pending rows they own; same for superadmin on any row.
- **Legacy** `POST .../image` on ingredients updates `image_url` and appends gallery metadata for compatibility.

## Public (no session)

- `**GET /public/restaurants`** — active restaurants for discovery (`id`, `name`, `slug`, `description`, `logoUrl`).
- `**GET /public/restaurants/:slug/menu**` — nested **published** menus → sections → dishes (with `**media`**) → ingredients (with `**media**` and derived `imageUrl`). **Approved** ingredients globally; **pending** only when the requester restaurant matches the menu’s restaurant.

---

## User restrictions

- `**GET /users/me/restrictions`** — list the caller's restrictions (session required). Each row includes linked `ingredient` object (`id`, `canonicalName`, `slug`) or `null`.
- `**POST /users/me/restrictions**` — add a restriction: `restrictionType` (`allergy` | `dislike` | `diet`), `severity` (`block` | `warn`), and either `ingredientId` or `dietType`.
- `**DELETE /users/me/restrictions/:id**` — remove a restriction; scoped to the caller (cannot delete another user's).

## QR code

- `**GET /restaurants/:id/qr**` — returns a PNG QR code (400×400) encoding `${DINER_APP_URL}/r/<slug>`. Auth: restaurant owner/admin or superadmin. Env var `DINER_APP_URL` (default `http://localhost:3003`).

## AI ingredient suggestions

- `**POST /api/v1/dishes/suggest-ingredients**` — restaurant admin or superadmin only. Sends dish name + optional description/context to **Google Gemini** (model configurable via `AI_SUGGESTION_MODEL` env var, default `gemini-2.0-flash-lite`). Returns a ranked list of ingredient suggestions, each with: `suggestedName`, `confidence` (`high`/`medium`), and `matchedIngredient` if an existing dictionary entry matches (exact or pg_trgm fuzzy match). Low-confidence suggestions are filtered out server-side. `shouldCreate: true` indicates the ingredient is not in the dictionary yet. Returns `503` when `GEMINI_API_KEY` is absent; graceful `502` on provider errors.
- **Fuzzy matching:** first tries case-insensitive exact match, then `similarity()` via pg_trgm (skipped silently if extension is unavailable). Threshold configurable via `AI_FUZZY_MATCH_THRESHOLD` (default `0.6`).
- **Env vars:** `GEMINI_API_KEY`, `AI_SUGGESTION_MODEL`, `AI_SUGGESTION_TEMPERATURE`, `AI_SUGGESTION_MAX_TOKENS`, `AI_FUZZY_MATCH_THRESHOLD`.

## User preferences

- `**GET /users/me/preferences`** — returns stored free-text preference and a `hasEmbedding` flag (`true` once the FastAPI server has embedded it). `404` when not yet set.
- `**PUT /users/me/preferences**` — upsert preference text (`10–2000` chars). On update, invalidates the stale embedding so the FastAPI embedding server picks it up on its next run. `201` on first create, `200` on update.
- `**DELETE /users/me/preferences**` — removes the preference; cascades to delete the embedding row.

## Semantic recommendations (pgvector)

- `**GET /users/me/recommendations**` — returns ranked dish list using pgvector `<=>` cosine distance between dish embeddings and the user's preference embedding. Filters to `is_available = true` and `is_published = true` menus. Optional `?restaurantId=` narrows scope. `?limit=` (default `10`, max `50`). Returns `400 NO_PREFERENCE` or `202 EMBEDDING_PENDING` before embeddings exist. Stores results in `recommendations` table.
- `**POST /recommendations/:id/feedback**` — records `clicked | selected | dismissed` interaction on a shown recommendation (scoped to caller).
- `**GET /users/me/recommendations/history**` — paginated past recommendations with dish names. `?limit=` / `?offset=`.
- **DB:** `user_preferences`, `dish_embeddings`, `user_preference_embeddings`, `embedding_jobs`, `recommendations`, `recommendation_feedback` tables + HNSW index on `dish_embeddings(embedding)`. Migration `0006_embeddings.sql`.
- **Embedding pipeline:** handled by a separate FastAPI server (not this repo) that writes to `dish_embeddings` and `user_preference_embeddings` via the shared DB.

## Social layer (Phase 1)

- **User public profiles:** `GET /users/:userId/profile` returns `followerCount`, `followingCount`, `postCount`, `isFollowedByMe`. `PATCH /users/me/profile` updates `displayName` and `bio`. `POST /users/me/avatar` uploads avatar image.
- **Follows:** `POST/DELETE /users/:userId/follow` (idempotent, self-follow blocked). Follower/following lists with cursor pagination.
- **Posts:** `POST /posts` creates a text post optionally tagged to a restaurant. `GET /posts` lists with optional filters. `DELETE /posts/:postId` (author only). `POST /posts/:postId/media` uploads images/videos (stored under `uploads/posts/`).
- **Likes:** `POST/DELETE /posts/:postId/like` — idempotent toggle; returns current `likeCount`. Batch N+1-free for list responses.
- **Comments:** `GET/POST /posts/:postId/comments` with one-level reply threading via `parentCommentId`. `DELETE /posts/:postId/comments/:commentId` (author only, cascades to replies).
- **Feed:** `GET /feed` — chronological posts from followed users + own posts, cursor-based.
- **Restaurant posts (public):** `GET /public/restaurants/:slug/posts` — no auth required; community posts about a restaurant.
- **`GET /auth/me`** now also returns `avatarUrl` and `bio`.

## AI chat recommendations

- **`POST /public/restaurants/:slug/chat`** — auth required (diners); sends a message to a Gemini-powered recommendation assistant. Context passed to the LLM: full published menu (section → dish name/price/description), user preference text, dietary restrictions, and a rolling conversation summary. Returns `{ message, recommendations: [{dishName, reason}], sessionId }`.
- **`GET /public/restaurants/:slug/chat/history`** — returns `{ restaurantName, messages, summary }` for this user × restaurant session.
- **`DELETE /public/restaurants/:slug/chat`** — clears the session.
- **Persistence:** one `ai_chat_sessions` row per user × restaurant (stores rolling `conversation_summary`); unlimited `ai_chat_messages` per session.
- **Token management:** last 10 messages always passed to the LLM. When a session exceeds 20 messages, the oldest messages are summarized (via `gemini-2.0-flash-lite`) and deleted; the summary is stored on the session and prepended to future prompts.
- **Env vars:** `GEMINI_API_KEY` (required), `AI_CHAT_MODEL` (default `gemini-2.0-flash`).
- **DB:** `ai_chat_sessions`, `ai_chat_messages` tables. Migration `0008_ai_chat.sql`.

## Not implemented here (see `PROGRESS.md`)

- Systematic **rate limiting** on search (plan Step 5).
- Rate limiting on AI suggestion endpoint (plan security requirement).

