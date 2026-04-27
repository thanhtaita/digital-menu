# API — implemented features

What **this service** exposes and enforces today. Canonical path list: root `IMPLEMENTED_ROUTES.md`. Planned but missing: `PROGRESS.md` + `TECH_PLAN.md`.

---

## Platform & auth

- **Health:** liveness-style `GET /health` under `/api/v1`.
- **CORS** with credentials; **cookies** for sessions.
- **Better Auth:** `POST` register/login, `POST` logout, `GET` me (`/api/v1/auth/*`).
- **Role-aware behavior** on ingredient and write routes (diner vs restaurant admin vs superadmin).

## File uploads (local dev)

- **`GET /uploads/...`** (not under `/api/v1`): static files from upload root (`UPLOAD_DIR` / `apps/api/uploads`).
- **Multipart** body size limits enforced on upload routes.
- **Dish gallery:** append image/video, reorder, delete (deletes DB row and local file when URL is under `/uploads/`).
- **Ingredient gallery:** same pattern for dictionary ingredients (with auth rules below).
- **Legacy single image** endpoints still update `image_url` while also supporting the newer `media` arrays.

## Restaurants & menu hierarchy

- **Restaurants:** list, create, get by id, patch (e.g. name, slug, description, logo, active flag).
- **Menus** (under restaurant): full CRUD; **`is_published`** drives public menu visibility.
- **Sections** (under menu): full CRUD including ordering concerns handled by API + client.
- **Dishes** (under section): full CRUD; list/detail responses include ordered **`media`**.
- **Dish translations:** `GET/PUT/DELETE .../dishes/:id/translations/:locale` — restaurant admin or superadmin; `PUT` upserts (creates or replaces); locale validated as BCP-47.
- **Dish ↔ ingredients:** list links for a dish, add an ingredient to a dish, remove a link.

## Ingredient dictionary

- **Search** `GET /ingredients?q=` — approved ingredients for everyone; logged-in restaurant staff also see **pending** rows they are allowed to see (e.g. requested by a restaurant they manage). Responses include ordered **`media`** (`image` | `video`).
- **Superadmin:** list all **pending** requests; **create** approved ingredient immediately; **approve** a pending row; **patch** (edit name/description/allergen); **delete** any ingredient with in-use conflict check.
- **Ingredient translations:** `GET/PUT/DELETE /ingredients/:id/translations/:locale` — **superadmin only**; same upsert/delete semantics as dish translations.
- **Restaurant admin:** **request** a new ingredient (creates **pending** for that restaurant); upload/reorder/delete **media** on pending rows they own; same for superadmin on any row.
- **Legacy** `POST .../image` on ingredients updates `image_url` and appends gallery metadata for compatibility.

## Public (no session)

- **`GET /public/restaurants`** — active restaurants for discovery (`id`, `name`, `slug`, `description`, `logoUrl`).
- **`GET /public/restaurants/:slug/menu`** — nested **published** menus → sections → dishes (with **`media`**) → ingredients (with **`media`** and derived `imageUrl`). **Approved** ingredients globally; **pending** only when the requester restaurant matches the menu’s restaurant.

---

## User restrictions

- **`GET /users/me/restrictions`** — list the caller's restrictions (session required). Each row includes linked `ingredient` object (`id`, `canonicalName`, `slug`) or `null`.
- **`POST /users/me/restrictions`** — add a restriction: `restrictionType` (`allergy` | `dislike` | `diet`), `severity` (`block` | `warn`), and either `ingredientId` or `dietType`.
- **`DELETE /users/me/restrictions/:id`** — remove a restriction; scoped to the caller (cannot delete another user's).

## QR code

- **`GET /restaurants/:id/qr`** — returns a PNG QR code (400×400) encoding `${DINER_APP_URL}/r/<slug>`. Auth: restaurant owner/admin or superadmin. Env var `DINER_APP_URL` (default `http://localhost:3003`).

## Not implemented here (see `PROGRESS.md`)

- Systematic **rate limiting** on search (plan Step 5).
