# Implemented Routes Reference

This file lists the routes that are currently implemented in this codebase.

## API Routes

Base URL: `http://localhost:3002/api/v1`

### Health
- `GET /health`

### Auth (`/auth`)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Ingredients (`/ingredients`)
- `GET /ingredients` — `GET /ingredients?q=<term>` — dictionary search: **approved** ingredients only when unauthenticated; when logged in, also includes **pending** ingredients requested by restaurants you manage (owner or `restaurant_admins`).
- `GET /ingredients/pending` — list all pending requests (**superadmin only**); includes requesting restaurant name when set.
- `POST /ingredients` — **Superadmin:** body `createIngredientSchema` → creates **approved** entry immediately. **Restaurant admin:** body `requestIngredientSchema` (`canonicalName`, `restaurantId`, optional `slug` / `description`) → creates **pending** entry for that restaurant (`403` if you do not manage the restaurant). Diners: `403`.
- `POST /ingredients/:id/approve` — set ingredient to **approved** (**superadmin only**).
- `DELETE /ingredients/:id` — reject a **pending** ingredient (**superadmin only**); `409` if still linked to dishes.

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
- `GET /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes`
- `POST /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes`
- `GET /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes/:dishId`
- `PATCH /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes/:dishId`
- `DELETE /restaurants/:restaurantId/menus/:menuId/sections/:sectionId/dishes/:dishId`

### Dish Ingredients (`/dishes/:dishId/ingredients`)
- `GET /dishes/:dishId/ingredients`
- `POST /dishes/:dishId/ingredients`
- `DELETE /dishes/:dishId/ingredients/:ingredientId`

### Public (no auth)
- `GET /public/restaurants/:slug/menu` — **Published** menus only (`is_published`), **active** restaurants (`is_active`). Nested menus → sections → dishes → ingredients (non-`is_hidden` links). Ingredients: **approved** globally, or **pending** when `requested_by_restaurant_id` matches that restaurant. Response shape: `publicMenuResponseSchema` in `@digital-menu/shared`.

---

## Admin Portal Routes

Base URL (dev): `http://localhost:5173`

- `/login`
- `/register`
- `/app/restaurants`
- `/app/restaurants/:restaurantId/builder`
- `/app/meta/ingredients` — approve/reject pending requests and add official dictionary entries (**superadmin only**; other roles are redirected away)

Route fallback behavior:
- Unauthenticated users are redirected to `/login`.
- Unknown paths inside app shell redirect to `/app/restaurants`.

---

## Diner app (Next.js)

Base URL (dev): `http://localhost:3003`

- `/` — minimal landing (points to `/r/[slug]` pattern).
- `/r/[slug]` — server-rendered public menu for restaurant `slug`; ingredient names link to `?i=<ingredient-slug>` and open a detail modal (native `<dialog>`).

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

9. **Apply DB migration** `0002_ingredient_approval` (`pnpm --filter @digital-menu/db drizzle:migrate`) then run seed if needed.

10. **Restaurant request flow:** As a restaurant admin, open **Menu builder**, use **Request a new ingredient**, confirm it appears in search with “pending approval” only for that restaurant, tag a dish, then as superadmin approve it in **Ingredient catalog** and confirm it appears for everyone without the pending label.

11. **Public menu + diner:** Publish a menu (`is_published`), start API (`pnpm --filter @digital-menu/api dev`) and diner app (`pnpm --filter @digital-menu/diner-app dev`). Open `http://localhost:3003/r/<restaurant-slug>`, confirm dishes and ingredient links; click an ingredient and confirm the modal opens (`?i=` in URL). Compare with `GET http://localhost:3002/api/v1/public/restaurants/<slug>/menu`.

