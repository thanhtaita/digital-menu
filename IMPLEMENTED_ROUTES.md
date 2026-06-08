# Implemented Routes Reference

This file lists the routes that are currently implemented in this codebase.

## API Routes

Base URL: `http://localhost:3002/api/v1`

### Static files (local dev)

- `GET /uploads/...` — **Not** under `/api/v1`. Served by the API process from `apps/api/uploads/` (or `UPLOAD_DIR`). Dish/ingredient `imageUrl` values may store paths like `/uploads/dishes/<file>`; the diner app resolves these against the API origin (`NEXT_PUBLIC_API_BASE_URL`).

### Health
- `GET /health`

### Auth (`/auth`)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Ingredients (`/ingredients`)
- `GET /ingredients` — `GET /ingredients?q=<term>` — dictionary search: **approved** ingredients only when unauthenticated; when logged in, also includes **pending** ingredients requested by restaurants you manage (owner or `restaurant_admins`). Each row includes **`media`**: ordered gallery items `{ id, url, kind, displayOrder }` (`kind`: `image` | `video`).
- `GET /ingredients/pending` — list all pending requests (**superadmin only**); includes requesting restaurant name when set.
- `POST /ingredients` — **Superadmin:** body `createIngredientSchema` → creates **approved** entry immediately (response includes `media`, usually `[]`). **Restaurant admin:** body `requestIngredientSchema` (`canonicalName`, `restaurantId`, optional `slug` / `description`) → creates **pending** entry for that restaurant (`403` if you do not manage the restaurant). Diners: `403`.
- `POST /ingredients/:id/media` — multipart field `file` — **superadmin** (any ingredient) or **restaurant admin** for **pending** ingredients they requested (`requested_by_restaurant_id`). Appends to `ingredient_media`, saves under `uploads/ingredients/`. Returns `{ media }`.
- `PATCH /ingredients/:id/media/order` — JSON `{ orderedIds: number[] }` — same auth as media upload; reorders gallery.
- `DELETE /ingredients/:id/media/:mediaId` — same auth; removes row and local file when URL is `/uploads/...`.
- `POST /ingredients/:id/image` — multipart `file` (image only). Same auth as `/:id/media`. Appends an `ingredient_media` row and updates `ingredients.image_url` for legacy clients. Returns `{ imageUrl, ingredient }` (ingredient includes `media`).
- `POST /ingredients/:id/approve` — set ingredient to **approved** (**superadmin only**); response includes `media`.
- `PATCH /ingredients/:id` — update fields (`canonicalName`, `description`, `isCommonAllergen`, `commonAllergenGroup`) on any ingredient (**superadmin only**); `409` on name conflict.
- `DELETE /ingredients/:id` — delete any ingredient (**superadmin only**); `409` if still linked to dishes.
- `GET /ingredients/:id/translations` — list all locale translations for an ingredient (**superadmin only**).
- `PUT /ingredients/:id/translations/:locale` — create or replace the translation for `locale` (**superadmin only**). Body: `{ name, description? }`.
- `DELETE /ingredients/:id/translations/:locale` — remove a single locale translation (**superadmin only**).

### Restaurants (`/restaurants`)
- `GET /restaurants`
- `POST /restaurants`
- `GET /restaurants/:id`
- `PATCH /restaurants/:id`

### Menus (`/restaurants/:restaurantId/menus`)
- `GET /restaurants/:restaurantId/menus`
- `POST /restaurants/:restaurantId/menus`
- `GET /restaurants/:restaurantId/menus/:menuId`
- `PATCH /restaurants/:restaurantId/menus/:menuId`
- `DELETE /restaurants/:restaurantId/menus/:menuId`

### Sections (`/restaurants/:restaurantId/menus/:menuId/sections`)
- `GET /restaurants/:restaurantId/menus/:menuId/sections`
- `POST /restaurants/:restaurantId/menus/:menuId/sections`
- `PATCH /restaurants/:restaurantId/menus/:menuId/sections/:sectionId`
- `DELETE /restaurants/:restaurantId/menus/:menuId/sections/:sectionId`

### Dishes (`/restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes`)
- `GET /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes` — each dish includes **`media`** (ordered gallery).
- `POST /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes`
- `POST /.../dishes/:dishId/media` — multipart `file` (image or video); appends `dish_media`, saves under `uploads/dishes/`. Returns `{ media }`.
- `PATCH /.../dishes/:dishId/media/order` — JSON `{ orderedIds: number[] }`.
- `DELETE /.../dishes/:dishId/media/:mediaId`
- `POST /.../dishes/:dishId/image` — multipart `file` (image only); sets `dishes.image_url` and is the legacy single-image path. Returns `{ imageUrl, dish }` (dish includes `media`).
- `GET /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes/:dishId`
- `PATCH /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes/:dishId`
- `DELETE /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes/:dishId`
- `GET /.../dishes/:dishId/translations` — list all locale translations for a dish (restaurant admin or superadmin).
- `PUT /.../dishes/:dishId/translations/:locale` — create or replace translation for `locale`. Body: `{ name, description? }`.
- `DELETE /.../dishes/:dishId/translations/:locale` — remove a single locale translation.

### Dish Ingredients (`/dishes/:dishId/ingredients`)
- `GET /dishes/:dishId/ingredients`
- `POST /dishes/:dishId/ingredients`
- `DELETE /dishes/:dishId/ingredients/:ingredientId`

### AI Ingredient Suggestions
- `POST /dishes/suggest-ingredients` — auth required (restaurant admin or superadmin). Body: `{ dishName, restaurantId, description?, contextPrompt?, cuisineType? }`. Calls the configured AI provider (Gemini or OpenAI) to generate an ingredient list, then fuzzy-matches each suggestion against the ingredient dictionary. Returns `{ suggestions: [{ suggestedName, matchedIngredient?, confidence, shouldCreate, category? }], metadata: { model, tokensUsed, latencyMs } }`. Returns `503` if no AI provider is configured, `502` on AI provider failure.

### User restrictions (`/users/me/restrictions`)
- `GET /users/me/restrictions` — list the caller's restrictions; requires session. Each row includes `ingredient` object (`id`, `canonicalName`, `slug`) when a specific ingredient is linked, otherwise `null`.
- `POST /users/me/restrictions` — add a restriction; body `createRestrictionSchema` (`restrictionType`, `severity`, and either `ingredientId` or `dietType`). Returns `{ restriction }`.
- `DELETE /users/me/restrictions/:id` — remove a restriction owned by the caller; `404` if not found or not owned.

### User preferences (`/users/me/preferences`)
- `GET /users/me/preferences` — return stored free-text preference and `hasEmbedding` flag. `404` when none set. Requires session.
- `PUT /users/me/preferences` — upsert preference text (body: `{ preferenceText: string (10–2000 chars) }`). On update, invalidates the existing embedding so FastAPI re-embeds. Returns `201` on create, `200` on update.
- `DELETE /users/me/preferences` — delete preference and cascade-removes embedding. `404` when none set.

### Recommendations (`/users/me/recommendations`)
- `GET /users/me/recommendations` — return ranked dish list via pgvector cosine similarity. Query params: `?restaurantId=<id>&limit=<n>` (default `10`, max `50`). Returns `400` with `NO_PREFERENCE` code when no preference is set; returns `202` with `EMBEDDING_PENDING` code when preference exists but has not been embedded yet. Stores results in `recommendations` table before returning.
- `POST /recommendations/:id/feedback` — record an interaction on a recommendation. Body: `{ action: "clicked" | "selected" | "dismissed" }`. `404` if the recommendation doesn't belong to the caller.
- `GET /users/me/recommendations/history` — paginated past recommendations with dish name/description. Query params: `?limit=<n>&offset=<n>` (default limit `20`, max `100`).

### QR code
- `GET /restaurants/:id/qr` — returns a PNG QR code encoding `${DINER_APP_URL}/r/<slug>`. Auth: restaurant owner/admin or superadmin. `DINER_APP_URL` env var (default `http://localhost:3003`).

### Public (no auth)
- `GET /public/restaurants` — list active restaurants for diner discovery (`id`, `name`, `slug`, `description`, `logoUrl`).
- `GET /public/restaurants/:slug/menu` — **Published** menus only (`is_published`), **active** restaurants (`is_active`). Nested menus → sections → dishes (each with **`media`**) → ingredients (each with **`media`**; `imageUrl` is derived from first gallery image when present). **Approved** ingredients globally, or **pending** when `requested_by_restaurant_id` matches that restaurant. Response shape: `publicMenuResponseSchema` in `@digital-menu/shared`.
- `GET /public/restaurants/:slug/posts` — posts tagged to this restaurant, no auth required; cursor-based (`?before=<postId>&limit=<n>`); `likedByMe` always `false`.

### Social — Profiles
- `GET /users/:userId/profile` — optional auth; returns `userPublicProfileSchema` with `followerCount`, `followingCount`, `postCount`, `isFollowedByMe` (false when unauthenticated or own profile).
- `GET /users/:userId/posts` — optional auth; cursor-based list of posts by this user; `postListResponseSchema`.
- `PATCH /users/me/profile` — auth required; body `updateProfileSchema` (`displayName?`, `bio?`); cannot change email/role.
- `POST /users/me/avatar` — auth required; multipart image; stores under `uploads/avatars/`; updates `users.avatar_url`; returns `{ avatarUrl }`.

### Social — Follows
- `POST /users/:userId/follow` — auth required; idempotent (no error on duplicate); 400 on self-follow.
- `DELETE /users/:userId/follow` — auth required; 404 if not following.
- `GET /users/:userId/followers` — optional auth; cursor-based (`?before=<followId>&limit=<n>`); `followListResponseSchema`.
- `GET /users/:userId/following` — optional auth; same shape.

### Social — Posts
- `POST /posts` — auth required; body `createPostSchema` (`content`, `restaurantId?`); returns `{ post }`.
- `GET /posts` — optional auth; query: `?restaurantId=<id>&authorId=<id>&before=<postId>&limit=<n>`; returns `postListResponseSchema`.
- `GET /posts/:postId` — optional auth; returns `{ post }` with `likedByMe: false` when unauthenticated.
- `DELETE /posts/:postId` — auth required; author only; 403 otherwise.
- `POST /posts/:postId/like` — auth required; idempotent; returns `{ likeCount }`.
- `DELETE /posts/:postId/like` — auth required; returns `{ likeCount }`.
- `GET /posts/:postId/comments` — optional auth; top-level comments with `replies[]` nested one level.
- `POST /posts/:postId/comments` — auth required; body `createCommentSchema` (`content`, `parentCommentId?`).
- `DELETE /posts/:postId/comments/:commentId` — auth required; author only.
- `POST /posts/:postId/media` — auth required; multipart; stores under `uploads/posts/`; returns `{ media }`.

### Social — Feed
- `GET /feed` — auth required; chronological posts from followed users + own posts; cursor-based (`?before=<postId>&limit=<n>`); `postListResponseSchema`.

### AI Chat (`/public/restaurants/:slug/chat`)
- `POST /public/restaurants/:slug/chat` — auth required; body `{ message }` (1–1000 chars); sends a message to the AI recommendation assistant and returns `{ message, recommendations: [{dishName, reason}], sessionId }`. Each session is scoped to the authenticated user × restaurant; conversation is persisted.
- `GET /public/restaurants/:slug/chat/history` — auth required; returns `{ restaurantName, messages: [{id, role, content, createdAt}], summary }`. When a session has >20 messages, older turns are condensed into `summary` automatically.
- `DELETE /public/restaurants/:slug/chat` — auth required; clears the entire session (messages + summary) for this user × restaurant.

---

## Admin Portal Routes

Base URL (dev): `http://localhost:5173`

- `/login`
- `/register`
- `/app/restaurants`
- `/app/restaurants/:restaurantId/builder`
- `/app/meta/ingredients` — approve/reject pending requests and add official dictionary entries (**superadmin only**; other roles are redirected away)

**Upload UX (menu builder + meta ingredients):** File inputs for dish and ingredient galleries use **`multiple`** so several images/videos can be chosen in one dialog; the client uploads them sequentially. Reordering is done with **Up / Down** after upload (same for dish gallery and per-ingredient gallery in search results). Shared copy and `accept` types live in `apps/admin-portal/src/lib/upload-ui.ts`.

Route fallback behavior:
- Unauthenticated users are redirected to `/login`.
- Unknown paths inside app shell redirect to `/app/restaurants`.

---

## Diner app (Next.js)

Base URL (dev): `http://localhost:3003`

- `/` — restaurant discovery page (lists active restaurants and links to each `/r/[slug]` menu).
- `/r/[slug]` — server-rendered public menu for restaurant `slug`; ingredient names link to `?i=<ingredient-slug>` and open a detail modal. Logged-in users see restriction badges on dishes and highlighted ingredient pills.
- `/r/[slug]?tab=posts` — community posts tab for that restaurant; "Write a post" composer for logged-in users.
- `/r/[slug]/chat` — AI recommendations chat (auth required); conversational interface powered by the configured AI provider (Gemini or OpenAI); conversation persists across visits.
- `/login` — email + password login for diner users.
- `/register` — create a diner account (email, optional display name, password).
- `/profile` — view account info and manage dietary restrictions (add allergy/dislike by ingredient search, add diet type, remove existing).
- `/u/[userId]` — public user profile: avatar, bio, follower/following counts, follow/unfollow button, post grid.
- `/feed` — social feed (auth required); chronological posts from followed users + own posts; "Load more" pagination.
- `/posts/[postId]` — full post detail with media carousel and threaded comment section.

---

## Quick Manual QA Flow

1. Start API: `pnpm --filter @digital-menu/api dev`
2. Start admin portal: `pnpm --filter @digital-menu/admin-portal dev`
3. Open `/login`, authenticate, confirm redirect to `/app/restaurants`
4. Open menu builder from a restaurant card
5. Create menu -> section -> dish
6. Search ingredient and tag it to the selected dish
7. Verify tagged ingredient appears and can be removed
8. **Superadmin / meta owner:** Set a user’s `role` to `superadmin` in the `users` table (there is no self-service UI for this). Log in as that user, open **Ingredient catalog**, add a canonical ingredient, and confirm it appears in the menu builder search.

9. **Apply DB migrations** (in order): `pnpm --filter @digital-menu/db drizzle:migrate` — includes `0002_ingredient_approval`, **`0003`** (`dish_media`), **`0004`** (`ingredient_media`), **`0005`** (`dish_translations` + `ingredient_translations`). Run seed if needed.

10. **Restaurant request flow:** As a restaurant admin, open **Menu builder**, use **Request a new ingredient** (optional multi-file photos/videos), confirm it appears in search with “pending approval” only for that restaurant, tag a dish, then as superadmin approve it in **Ingredient catalog** and confirm it appears for everyone without the pending label.

11. **Public menu + diner:** Publish a menu (`is_published`), start API and diner app. Open `http://localhost:3003/r/<restaurant-slug>`, confirm dishes and ingredient links; click an ingredient and confirm the modal opens (`?i=` in URL). Compare with `GET http://localhost:3002/api/v1/public/restaurants/<slug>/menu`.

12. **Galleries (multi-select):** In **Menu builder**, select a dish, use **Add** with **multiple** files selected at once for the dish gallery; confirm **Up/Down** reorder and **Remove**. Do the same for an ingredient row in search (gallery + multi-select). As **superadmin**, open **Ingredient catalog** and add an ingredient with **multiple** files. Confirm files under `apps/api/uploads/dishes/` and `uploads/ingredients/`. Open the public diner menu and confirm images/videos load (resolved to `http://localhost:3002/uploads/...`).
