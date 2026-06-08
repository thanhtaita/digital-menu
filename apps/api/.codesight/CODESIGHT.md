# @digital-menu/api — AI Context Map

> **Stack:** fastify | drizzle | unknown | typescript

> 42 routes | 0 models | 0 components | 18 lib files | 11 env vars | 3 middleware
> **Token savings:** this file is ~1,900 tokens. Without it, AI exploration would cost ~34,800 tokens. **Saves ~32,900 tokens per conversation.**
> **Last scanned:** 2026-05-05 04:58 — re-run after significant changes

---

# Routes

## CRUD Resources

- **``** GET/:id | PATCH/:id | DELETE/:id
- **`/:dishId/translations`** GET | GET/:id | PUT/:id | DELETE/:id → Translation
- **`/:id/translations`** GET | GET/:id | PUT/:id | DELETE/:id → Translation
- **`/users/me/restrictions`** GET | POST | GET/:id | DELETE/:id → Restriction

## Other Routes

- `POST` `/dishes/suggest-ingredients` params() [auth]
- `POST` `/register` params() [auth, db]
- `POST` `/login` params() [auth, db]
- `POST` `/logout` params() [auth, db]
- `GET` `/me` params() [auth, db]
- `GET` `/` params() [auth, db]
- `POST` `/` params() [auth, db]
- `POST` `/:dishId/image` params(dishId) [auth, db, upload]
- `POST` `/:dishId/media` params(dishId) [auth, db, upload]
- `PATCH` `/:dishId/media/order` params(dishId) [auth, db, upload]
- `DELETE` `/:dishId/media/:mediaId` params(dishId, mediaId) [auth, db, upload]
- `GET` `/health` params()
- `GET` `/pending` params() [auth, db, upload]
- `POST` `/:id/media` params(id) [auth, db, upload]
- `PATCH` `/:id/media/order` params(id) [auth, db, upload]
- `DELETE` `/:id/media/:mediaId` params(id, mediaId) [auth, db, upload]
- `POST` `/:id/image` params(id) [auth, db, upload]
- `POST` `/:id/approve` params(id) [auth, db, upload]
- `GET` `/restaurants` params() [db]
- `GET` `/restaurants/:slug/menu` params(slug) [db]
- `GET` `/restaurants/:id/qr` params(id) [auth, db]

---

# Libraries

- `src\app.ts` — function buildApp: () => void
- `src\lib\auth.ts`
  - function hashPassword: (password) => Promise<string>
  - function verifyPassword: (password, hash) => Promise<boolean>
  - function createSessionId: () => string
  - function createSession: (userId) => Promise<string>
  - function getSession: (sessionId) => Promise<
  - function deleteSession: (sessionId) => Promise<void>
  - _...4 more_
- `src\lib\restaurant-access.ts`
  - function getRestaurantIdsManagedByUser: (userId) => Promise<number[]>
  - function canUserManageRestaurant: (userId, restaurantId) => Promise<boolean>
  - function canUserManageRestaurantWithRole: (userId, role, restaurantId) => Promise<boolean>
- `src\lib\uploads.ts`
  - function getUploadRoot: () => string
  - function ensureUploadRoot: () => Promise<void>
  - function extForImageMime: (mime) => string | undefined
  - function mediaKindFromMime: (mime) => MediaKind | undefined
  - function publicMediaPath: (subdir, filename) => string
  - function deleteLocalUploadByPublicUrl: (publicUrl) => Promise<void>
  - _...11 more_
- `src\middleware\auth.ts`
  - function requireAuth: (request, reply) => Promise<
  - function getOptionalUser: (request) => AuthUser | null
  - type AuthUser
- `src\routes\ai-suggestions.ts` — function aiSuggestionRoutes: (app) => void
- `src\routes\auth.ts` — function authRoutes: (app) => void
- `src\routes\dish-ingredients.ts` — function dishIngredientRoutes: (app) => void
- `src\routes\dishes.ts` — function dishRoutes: (app) => void
- `src\routes\health.ts` — function healthRoutes: (app) => void
- `src\routes\ingredients.ts` — function ingredientRoutes: (app) => void
- `src\routes\menus.ts` — function menuRoutes: (app) => void
- `src\routes\public-menu.ts` — function publicMenuRoutes: (app) => void
- `src\routes\qr.ts` — function qrRoutes: (app) => void
- `src\routes\restaurants.ts` — function restaurantRoutes: (app) => void
- `src\routes\restrictions.ts` — function restrictionRoutes: (app) => void
- `src\routes\sections.ts` — function sectionRoutes: (app) => void
- `src\services\ai-ingredient-suggestion.ts`
  - function suggestIngredients: (params) => Promise<SuggestIngredientsResult>
  - type MatchedIngredient
  - type IngredientSuggestionResult
  - type SuggestIngredientsResult

---

# Config

## Environment Variables

- `AI_AUTO_CREATE_CONFIDENCE` (has default) — .env
- `AI_FUZZY_MATCH_THRESHOLD` (has default) — .env
- `AI_SUGGESTION_MAX_TOKENS` (has default) — .env
- `AI_SUGGESTION_MODEL` (has default) — .env
- `AI_SUGGESTION_TEMPERATURE` (has default) — .env
- `DATABASE_URL` **required** — src\lib\db.ts
- `DINER_APP_URL` **required** — src\routes\qr.ts
- `GEMINI_API_KEY` (has default) — .env
- `NODE_ENV` **required** — src\lib\auth.ts
- `PORT` **required** — src\index.ts
- `UPLOAD_DIR` **required** — src\lib\uploads.ts

## Config Files

- `tsconfig.json`

## Key Dependencies

- @google/generative-ai: ^0.24.1
- drizzle-orm: ^0.38.0
- fastify: ^5.0.0
- pg: ^8.11.5

---

# Middleware

## auth
- auth — `src\lib\auth.ts`
- auth — `src\middleware\auth.ts`
- auth — `src\routes\auth.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src\lib\db.ts` — imported by **13** files
- `src\middleware\auth.ts` — imported by **9** files
- `src\lib\restaurant-access.ts` — imported by **7** files
- `src\lib\uploads.ts` — imported by **2** files
- `src\lib\auth.ts` — imported by **2** files
- `src\routes\health.ts` — imported by **1** files
- `src\routes\ingredients.ts` — imported by **1** files
- `src\routes\auth.ts` — imported by **1** files
- `src\routes\restaurants.ts` — imported by **1** files
- `src\routes\menus.ts` — imported by **1** files
- `src\routes\sections.ts` — imported by **1** files
- `src\routes\dishes.ts` — imported by **1** files
- `src\routes\dish-ingredients.ts` — imported by **1** files
- `src\routes\public-menu.ts` — imported by **1** files
- `src\routes\restrictions.ts` — imported by **1** files
- `src\routes\qr.ts` — imported by **1** files
- `src\routes\ai-suggestions.ts` — imported by **1** files
- `src\app.ts` — imported by **1** files
- `src\services\ai-ingredient-suggestion.ts` — imported by **1** files

## Import Map (who imports what)

- `src\lib\db.ts` ← `src\lib\auth.ts`, `src\lib\restaurant-access.ts`, `src\routes\auth.ts`, `src\routes\dish-ingredients.ts`, `src\routes\dishes.ts` +8 more
- `src\middleware\auth.ts` ← `src\routes\ai-suggestions.ts`, `src\routes\dish-ingredients.ts`, `src\routes\dishes.ts`, `src\routes\ingredients.ts`, `src\routes\menus.ts` +4 more
- `src\lib\restaurant-access.ts` ← `src\routes\ai-suggestions.ts`, `src\routes\dish-ingredients.ts`, `src\routes\dishes.ts`, `src\routes\menus.ts`, `src\routes\qr.ts` +2 more
- `src\lib\uploads.ts` ← `src\app.ts`, `src\routes\dishes.ts`
- `src\lib\auth.ts` ← `src\middleware\auth.ts`, `src\routes\ingredients.ts`
- `src\routes\health.ts` ← `src\app.ts`
- `src\routes\ingredients.ts` ← `src\app.ts`
- `src\routes\auth.ts` ← `src\app.ts`
- `src\routes\restaurants.ts` ← `src\app.ts`
- `src\routes\menus.ts` ← `src\app.ts`

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_