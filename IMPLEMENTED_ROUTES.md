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
- `GET /ingredients`
- `GET /ingredients?q=<term>`

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

---

## Admin Portal Routes

Base URL (dev): `http://localhost:5173`

- `/login`
- `/register`
- `/app/restaurants`
- `/app/restaurants/:restaurantId/builder`

Route fallback behavior:
- Unauthenticated users are redirected to `/login`.
- Unknown paths inside app shell redirect to `/app/restaurants`.

---

## Quick Manual QA Flow

1. Start API: `pnpm --filter @digital-menu/api dev`
2. Start admin portal: `pnpm --filter @digital-menu/admin-portal dev`
3. Open `/login`, authenticate, confirm redirect to `/app/restaurants`
4. Open menu builder from a restaurant card
5. Create menu -> section -> dish
6. Search ingredient and tag it to the selected dish
7. Verify tagged ingredient appears and can be removed

