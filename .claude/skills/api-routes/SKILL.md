---
name: api-routes
description: Full catalog of implemented HTTP API routes and frontend page routes, plus a manual QA walkthrough. Use when looking up an existing route before adding a new one, or when manually verifying a change end-to-end.
---

# API and page route catalog

This is the canonical route list for the whole monorepo (formerly root `IMPLEMENTED_ROUTES.md`, merged here). When you add, remove, or meaningfully change a route, **update this file in the same change**.

## API routes

Base URL: `http://localhost:3002/api/v1` (the `dev` script hardcodes `PORT=3002` via `cross-env`, overriding the `PORT=3001` fallback in `apps/api/src/index.ts` - see `docs/decisions/ADR-002-local-dev-api-port-default.md`).

### Static files (local dev)

- `GET /uploads/...` - **not** under `/api/v1`. Served by the API process from `apps/api/uploads/` (or `UPLOAD_DIR`). Dish/ingredient `imageUrl` values may store paths like `/uploads/dishes/<file>`; frontends resolve these against the API origin.

### Health

- `GET /health`

### Auth (`/auth`)

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me` - includes `avatarUrl` and `bio`.

### Ingredients (`/ingredients`)

- `GET /ingredients?q=<term>` - dictionary search: **approved** ingredients only when unauthenticated; logged-in restaurant staff also see **pending** ingredients requested by restaurants they manage. Each row includes ordered `media` (`{id, url, kind, displayOrder}`, `kind`: `image`|`video`).
- `GET /ingredients/pending` - all pending requests (**superadmin only**); includes requesting restaurant name.
- `POST /ingredients` - superadmin: `createIngredientSchema` → creates **approved** entry immediately. Restaurant admin: `requestIngredientSchema` (`canonicalName`, `restaurantId`, optional `slug`/`description`) → creates **pending** entry (`403` if you don't manage the restaurant). Diners: `403`.
- `POST /ingredients/:id/media` - multipart `file` - superadmin (any ingredient) or restaurant admin for pending ingredients they requested. Appends to `ingredient_media`, saves under `uploads/ingredients/`.
- `PATCH /ingredients/:id/media/order` - JSON `{orderedIds: number[]}` - same auth as media upload.
- `DELETE /ingredients/:id/media/:mediaId` - same auth; removes row and local file when URL is `/uploads/...`.
- `POST /ingredients/:id/image` - multipart `file` (image only, legacy). Appends a media row and updates `ingredients.image_url`.
- `POST /ingredients/:id/approve` - superadmin only.
- `PATCH /ingredients/:id` - update `canonicalName`/`description`/`isCommonAllergen`/`commonAllergenGroup` (superadmin only); `409` on name conflict.
- `DELETE /ingredients/:id` - superadmin only; `409` if still linked to dishes.
- `GET /ingredients/:id/translations` - superadmin only.
- `PUT /ingredients/:id/translations/:locale` - create/replace (superadmin only). Body `{name, description?}`.
- `DELETE /ingredients/:id/translations/:locale` - superadmin only.
- `GET /ingredients/fdc-candidates` - superadmin only; pending USDA FoodData Central match review queue (see the "FDC nutrition backfill" section in the `seed-and-ingredient-data` skill). Each row: `{id, ingredientId, ingredientCanonicalName, fdcId, fdcDescription, fdcDataType, score, status: "pending", createdAt}`. `fdcDataType` is the matched source (`foundation_food`/`sr_legacy_food`/`survey_fndds_food`), nullable for candidates queued before this field existed.
- `GET /ingredients/fdc-candidates/:id/detail` - superadmin only; everything needed to judge one match side by side, for the admin-portal's click-to-expand detail dialog. Returns `{candidate: {id, fdcId, fdcDescription, fdcDataType, score, status, createdAt}, ingredient: {...full ingredients row, media[], aliases: {id, alias, languageCode}[]}, fdc: {fdcId, description, dataType, foodCategory, nutrients: {name, unitName, amount, rank}[], portions: {amount, unit, portionDescription, modifier, gramWeight}[]} | null}`. `fdc` is the **full** nutrient panel (every `fdc.food_nutrient` row for that `fdc_id`, not just `FDC_NUTRIENT_IDS`) plus household portions from `fdc.food_portion` - see `fetchFdcFullDetail` in `apps/api/src/services/fdc-matching.ts`. `fdc` is `null` if the `fdc_id` no longer resolves (e.g. the reference data was reloaded since the candidate was queued). `404` if the candidate or its ingredient no longer exists.
- `POST /ingredients/fdc-candidates/:id/accept` - superadmin only; copies nutrients/food category from `fdc.*` into the ingredient, sets `ingredients.fdc_id`, returns the updated ingredient. `404` if not pending.
- `POST /ingredients/fdc-candidates/:id/reject` - superadmin only; dismisses the candidate (`204`). `404` if not pending.
- `GET /ingredients/diet-candidates` - superadmin only; pending LLM-proposed diet-compatibility tags (see the "Diet-type restriction filtering" section in the `seed-and-ingredient-data` skill). Each row: `{id, ingredientId, ingredientCanonicalName, dietType, compatible, confidence, reasoning, status: "pending", createdAt}`.
- `POST /ingredients/diet-candidates/:id/accept` - superadmin only; merges the tag into `ingredients.diet_tags`, returns the updated ingredient. `404` if not pending.
- `POST /ingredients/diet-candidates/:id/reject` - superadmin only; dismisses the candidate (`204`). `404` if not pending.

### Restaurants (`/restaurants`)

- `GET /restaurants`
- `POST /restaurants`
- `GET /restaurants/:id`
- `PATCH /restaurants/:id`

### Menus (`/restaurants/:restaurantId/menus`)

- `GET`, `POST` on the collection; `GET`, `PATCH`, `DELETE` on `/:menuId`.

### Sections (`/restaurants/:restaurantId/menus/:menuId/sections`)

- `GET`, `POST` on the collection; `PATCH`, `DELETE` on `/:sectionId`.

### Dishes (`/restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes`)

- `GET` collection - each dish includes ordered `media`.
- `POST` collection.
- `POST /.../dishes/:dishId/media` - multipart `file` (image or video); saves under `uploads/dishes/`.
- `PATCH /.../dishes/:dishId/media/order` - JSON `{orderedIds: number[]}`.
- `DELETE /.../dishes/:dishId/media/:mediaId`
- `POST /.../dishes/:dishId/image` - multipart `file` (legacy single image path); sets `dishes.image_url`.
- `GET`, `PATCH`, `DELETE` on `/:dishId`.
- `GET /.../dishes/:dishId/translations`, `PUT .../translations/:locale`, `DELETE .../translations/:locale` (restaurant admin or superadmin).

### Dish ingredients (`/dishes/:dishId/ingredients`)

- `GET`, `POST` on the collection; `DELETE /:ingredientId`.

### AI ingredient suggestions

- `POST /dishes/suggest-ingredients` - auth required (restaurant admin or superadmin). Body `{dishName, restaurantId, description?, contextPrompt?, cuisineType?}`. Calls the configured AI provider, then fuzzy-matches suggestions against the dictionary. Returns `{suggestions: [{suggestedName, matchedIngredient?, confidence, shouldCreate, category?}], metadata: {model, tokensUsed, latencyMs}}`. `503` if no AI provider configured, `502` on provider failure.

### User restrictions (`/users/me/restrictions`)

- `GET` - each row includes `ingredient` (`id`, `canonicalName`, `slug`) or `null`.
- `POST` - body `createRestrictionSchema` (`restrictionType`, `severity`, and either `ingredientId` or `dietType`).
- `DELETE /:id` - scoped to caller; `404` otherwise.

### User preferences (`/users/me/preferences`)

- `GET` - preference text + `hasEmbedding` flag; `404` when none set.
- `PUT` - upsert (`preferenceText`, 10-2000 chars); invalidates the existing embedding on update. `201` create / `200` update.
- `DELETE` - cascades to remove the embedding.

### Recommendations (`/users/me/recommendations`)

- `GET` - pgvector cosine similarity ranking. Query `?restaurantId=&limit=` (default 10, max 50). `400 NO_PREFERENCE` / `202 EMBEDDING_PENDING` before a preference/embedding exists. Stores results in `recommendations`.
- `POST /recommendations/:id/feedback` - body `{action: "clicked"|"selected"|"dismissed"}`; `404` if not caller's.
- `GET /users/me/recommendations/history` - paginated (`?limit=&offset=`, default limit 20, max 100).

### QR code

- `GET /restaurants/:id/qr` - PNG encoding `${DINER_APP_URL}/r/<slug>`. Auth: owner/admin or superadmin. `DINER_APP_URL` default `http://localhost:3003`.

### Public (no auth)

- `GET /public/restaurants` - active restaurants for discovery (`id`, `name`, `slug`, `description`, `logoUrl`).
- `GET /public/restaurants/:slug/menu` - published menus only, active restaurants only. Nested menus → sections → dishes (with `media`) → ingredients (with `media`; `imageUrl` derived from first gallery image). Approved ingredients globally, or pending when `requested_by_restaurant_id` matches. Shape: `publicMenuResponseSchema` in `@digital-menu/shared`.
- `GET /public/restaurants/:slug/posts` - posts tagged to this restaurant, no auth; cursor-based (`?before=&limit=`); `likedByMe` always `false`.
- `GET /public/search?q=` - platform-wide search across dish name/description/ingredient canonical names and restaurant name/description, via `pg_trgm` `similarity()` + `ILIKE` (`apps/api/src/services/search.ts`). Rate-limited (`SEARCH_RATE_LIMIT`, 60/min). Same visibility rules as the two routes above: only active restaurants, only dishes on a published menu of an active restaurant, only approved/non-hidden ingredients. `q` under 2 chars returns empty arrays. Shape: `publicSearchResponseSchema` in `@digital-menu/shared`. See `docs/goals/diner-discovery/features/platform-wide-search/`.

### Social - profiles

- `GET /users/:userId/profile` - optional auth; `userPublicProfileSchema` with `followerCount`, `followingCount`, `postCount`, `isFollowedByMe` (false when unauthenticated or own profile).
- `GET /users/:userId/posts` - optional auth; cursor-based.
- `PATCH /users/me/profile` - auth required; `updateProfileSchema` (`displayName?`, `bio?`); cannot change email/role.
- `POST /users/me/avatar` - auth required; multipart image; `uploads/avatars/`; returns `{avatarUrl}`.

### Social - follows

- `POST /users/:userId/follow` - idempotent, `400` on self-follow.
- `DELETE /users/:userId/follow` - `404` if not following.
- `GET /users/:userId/followers` / `/following` - optional auth, cursor-based.

### Social - posts

- `POST /posts` - `createPostSchema` (`content`, `restaurantId?`).
- `GET /posts` - optional auth; `?restaurantId=&authorId=&before=&limit=`.
- `GET /posts/:postId` - optional auth; `likedByMe: false` when unauthenticated.
- `DELETE /posts/:postId` - author only.
- `POST`/`DELETE /posts/:postId/like` - idempotent; returns `{likeCount}`.
- `GET /posts/:postId/comments` - top-level with `replies[]` nested one level.
- `POST /posts/:postId/comments` - `createCommentSchema` (`content`, `parentCommentId?`).
- `DELETE /posts/:postId/comments/:commentId` - author only.
- `POST /posts/:postId/media` - multipart; `uploads/posts/`.

### Social - feed

- `GET /feed` - auth required; chronological, followed users + own posts, cursor-based.

### AI chat (`/public/restaurants/:slug/chat`)

See the `ai-chat-architecture` skill for full design. Routes: `POST /chat` (blocking), `POST /chat/stream` (SSE), `GET /chat/history`, `DELETE /chat`, `POST /chat/like`.

## Admin portal routes

Base URL (dev): `http://localhost:5173`.

- `/login`, `/register`
- `/app/restaurants` - restaurant cards include a "QR code" button (fetches `GET /restaurants/:id/qr` as a blob, shows the PNG in a modal with a download link)
- `/app/restaurants/:restaurantId/builder`
- `/app/meta/ingredients` - superadmin only; others redirected away

Upload UX: dish/ingredient gallery file inputs use `multiple`; client uploads sequentially; reordering via Up/Down. Shared copy/`accept` types in `apps/admin-portal/src/lib/upload-ui.ts`. Unauthenticated users → `/login`; unknown paths → `/app/restaurants`.

## Diner app routes

Base URL (dev): `http://localhost:3003`.

- `/` - discovery (active restaurants); includes a search box (`SearchBox` component, also in `SiteHeader` on most other pages).
- `/search?q=` - platform-wide search results, grouped into Restaurants and Dishes; each dish result links to `/r/[slug]#dish-{id}`.
- `/r/[slug]` - server-rendered public menu; ingredient links open `?i=<slug>` modal; logged-in users see restriction badges.
- `/r/[slug]?tab=posts` - restaurant community posts tab, with composer for logged-in users.
- `/r/[slug]/chat` - AI recommendations chat (auth required).
- `/login`, `/register`
- `/profile` - account info + dietary restrictions CRUD + taste preferences.
- `/u/[userId]` - public profile: avatar, bio, follower/following counts, follow button, post grid.
- `/feed` - auth required; chronological posts from followed users + own, "Load more" pagination.
- `/posts/[postId]` - full post detail, media carousel, threaded comments.

## Manual QA walkthrough

1. Start API: `pnpm --filter @digital-menu/api dev`. Start admin portal: `pnpm --filter @digital-menu/admin-portal dev`.
2. Open `/login`, authenticate, confirm redirect to `/app/restaurants`.
3. Open menu builder from a restaurant card; create menu → section → dish.
4. Search an ingredient and tag it to the selected dish; confirm it appears and can be removed.
5. **Superadmin**: set a user's `role` to `superadmin` directly in the `users` table (no self-service UI). Log in as that user, open **Ingredient catalog**, add a canonical ingredient, confirm it appears in menu-builder search.
6. Apply DB migrations in order (`pnpm --filter @digital-menu/db drizzle:migrate`) - see the `db-migration` skill; run seed scripts if needed (see `seed-and-ingredient-data` skill).
7. **Restaurant request flow**: as a restaurant admin, use **Request a new ingredient** (optional multi-file photos/videos) in the menu builder; confirm it shows "pending approval" only for that restaurant; tag a dish; as superadmin, approve it in **Ingredient catalog**; confirm it now appears for everyone without the pending label.
8. **Public menu + diner**: publish a menu, start the diner app, open `http://localhost:3003/r/<slug>`, confirm dishes/ingredient links render; click an ingredient and confirm the modal opens (`?i=` in URL). Cross-check against `GET http://localhost:3002/api/v1/public/restaurants/<slug>/menu`.
9. **Galleries (multi-select)**: in menu builder, select a dish, add multiple files at once for the dish gallery; confirm Up/Down reorder and Remove. Repeat for an ingredient row in search results. As superadmin, add an ingredient with multiple files in **Ingredient catalog**. Confirm files land under `apps/api/uploads/dishes/` and `uploads/ingredients/`; confirm images/videos load on the public diner menu (resolved to `http://localhost:3002/uploads/...`).
10. **Social - two users**: use two browser windows/incognito. Register User A (note user ID from the nav link) and User B. User B visits `/u/{A's id}` and clicks **Follow**. User A creates a post via a restaurant's Posts tab. User B checks `/feed` - A's post appears. User B likes the post and leaves a comment. User A replies to B's comment. Check `/u/{A's id}` - post appears in the grid, follower count is 1.
11. Confirm `/profile` restriction CRUD (add allergy/dislike by ingredient search, add a diet type, remove) and that dish badges (blocked = red, warned = amber) render correctly on `/r/[slug]` for a logged-in diner.
12. Open `/r/[slug]/chat`, send a message, confirm streaming text appears progressively, recommendation cards render, liking a card persists, and "Clear" resets the conversation.
13. **Search**: from `/` or any page's header, search a dish name, a partial/typo'd dish name, and an ingredient name not in any dish's name/description - confirm relevant restaurants/dishes appear, grouped, with each dish result linking into its restaurant's menu. Confirm an inactive restaurant or unpublished-menu dish never appears, even for an exact-name query.
