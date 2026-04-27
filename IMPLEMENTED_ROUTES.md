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

### User restrictions (`/users/me/restrictions`)
- `GET /users/me/restrictions` — list the caller's restrictions; requires session. Each row includes `ingredient` object (`id`, `canonicalName`, `slug`) when a specific ingredient is linked, otherwise `null`.
- `POST /users/me/restrictions` — add a restriction; body `createRestrictionSchema` (`restrictionType`, `severity`, and either `ingredientId` or `dietType`). Returns `{ restriction }`.
- `DELETE /users/me/restrictions/:id` — remove a restriction owned by the caller; `404` if not found or not owned.

### QR code
- `GET /restaurants/:id/qr` — returns a PNG QR code encoding `${DINER_APP_URL}/r/<slug>`. Auth: restaurant owner/admin or superadmin. `DINER_APP_URL` env var (default `http://localhost:3003`).

### Public (no auth)
- `GET /public/restaurants` — list active restaurants for diner discovery (`id`, `name`, `slug`, `description`, `logoUrl`).
- `GET /public/restaurants/:slug/menu` — **Published** menus only (`is_published`), **active** restaurants (`is_active`). Nested menus → sections → dishes (each with **`media`**) → ingredients (each with **`media`**; `imageUrl` is derived from first gallery image when present). **Approved** ingredients globally, or **pending** when `requested_by_restaurant_id` matches that restaurant. Response shape: `publicMenuResponseSchema` in `@digital-menu/shared`.

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
- `/r/[slug]` — server-rendered public menu for restaurant `slug`; ingredient names link to `?i=<ingredient-slug>` and open a detail modal (native `<dialog>`). Logged-in users see restriction badges (blocked / warn) on dishes and highlighted ingredient pills.
- `/login` — email + password login for diner users.
- `/register` — create a diner account (email, optional display name, password).
- `/profile` — view account info and manage dietary restrictions (add allergy/dislike by ingredient search, add diet type, remove existing).

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
