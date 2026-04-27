# Diner app — implemented features

What **guests** get on the public Next.js site. API contract: `GET /public/restaurants` and `GET /public/restaurants/:slug/menu`. Gaps vs full plan: `PROGRESS.md`.

---

## Discovery (`/`)

- **Server-rendered** list of **active** public restaurants.
- Each card shows **name**, **slug**, optional **description** and **logo** (when the API provides a URL), linking to that restaurant’s menu.

## Menu page (`/r/[slug]`)

- **Server-side fetch** of the published menu payload for the slug.
- **Restaurant header:** logo (when present), name, optional description.
- **Empty state** when there is no published menu yet.
- **Structure:** published **menus** → **sections** → **dishes**.

## Dish presentation

- **Name, price, description**; visually **muted** when the dish is marked unavailable, with a short “currently unavailable” note.
- **Media:** horizontal gallery of **images** and inline **videos** when the API sends `media`; falls back to legacy **single image** when only `imageUrl` exists.

## Ingredients as tags

- Ingredients render as **pill links** (`?i=<ingredient-slug>`); optional **(optional)** label when the link is optional on the dish.
- **Clicking a tag** opens detail without a full navigation away (URL updates for sharing/bookmarking).

## Ingredient detail (modal)

- **Fixed overlay + bottom sheet** (plain `div`s, not `<dialog>`) driven by the `i` query param: open when valid, close clears the param after a short **slide-down** dismiss (matches slide-up open).
- **Chrome:** grab handle on smaller viewports (`<1024px`); **Close** in the sheet header on desktop (`≥1024px`). Backdrop tap and Escape still dismiss.
- Shows **canonical name**, **which dish** it appears on, and **gallery or legacy image** (plus inline video in gallery).
- **Allergen callout** when the ingredient is flagged as a common allergen (with group text when present).
- **Description** when available.
- **Nutrients:** up to a **limited set** of key/value rows when JSON nutrients exist on the ingredient.

---

## Auth (`/login`, `/register`)

- **Log in** with email and password; session kept via API cookie.
- **Register** as a diner (email, optional display name, password); no restaurant fields.
- **Site header** shows current user name or email with a logout button; unauthenticated visitors see Log in / Register links.

## Profile and restrictions (`/profile`)

- Shows account email and display name.
- **List** existing dietary restrictions with type and severity badge.
- **Add** a restriction: choose type (`allergy` / `dislike` → search ingredient by name; `diet` → select from preset diet types). Severity auto-set or selectable (`block` / `warn`).
- **Remove** any restriction immediately.

## Restriction engine and dish badges

- On `/r/[slug]`, when logged in, each dish is evaluated against the user's allergy/dislike restrictions.
- **Blocked dish** (contains a `block`-severity ingredient): card highlighted red + "Contains allergen" badge.
- **Warned 2dish** (contains a `warn`-severity ingredient): card highlighted amber + "Contains disliked ingredient" badge.
- **Ingredient pills** that match a restriction are highlighted red for quick identification.
- Diet-type restrictions are stored on the profile but not yet applied to dish filtering (Phase 2).

## Not implemented here (see `PROGRESS.md`)

- Diet-type dish filtering, Playwright E2E, user restriction sync/caching.

