# Admin portal — implemented features

Concise checklist of what **this app** does today. For HTTP paths see root `IMPLEMENTED_ROUTES.md`; for gaps vs plan see `PROGRESS.md`.

---

## Account & shell

- **Register** and **log in** with email/password; session kept via API cookies.
- **Log out** clears the session.
- **Auth gating:** unauthenticated users go to `/login`; unknown in-app paths fall back to the restaurant list.

## Restaurants

- **List** restaurants you can access (name, slug, optional description snippet).
- **Edit** restaurant name and description inline from the list page.
- **Open menu builder** from each restaurant card.

## Menu builder (per restaurant)

- **Menus:** create, select, **rename inline**, delete (blocked if sections exist; shows cascading warning).
- **Publish / unpublish** the selected menu so it appears on the public diner menu when published.
- **Sections:** add, **rename inline**, delete (blocked if dishes exist; shows cascading warning).
- **Dishes:** add, **edit all fields inline** (name, price, description, available/unavailable), delete with confirmation.
- **Dish media:** upload **multiple** images or videos in one go; **reorder** gallery (up/down); **remove** with confirmation dialog.
- **Ingredients on a dish:** debounced **search** the dictionary; **attach** and **detach** ingredients on the selected dish.
- **Request a new ingredient:** shown inline below the search only when there are **no results** — form pre-fills with the search query. Pending entries show in search for **your** restaurant until approved.
- **Ingredient rows in search:** when allowed, manage a small **gallery** (upload multiple files, reorder, remove with confirmation) for that ingredient.
- **AI ingredient suggestions:** when a dish is selected, a collapsible panel in the "Tag ingredients" card lets restaurant admins generate AI-powered ingredient suggestions. An optional context field (e.g., "Vietnamese style, extra spicy") refines results. After clicking **Generate ingredient suggestions**, the panel shows a checklist of high/medium-confidence matches — each with its confidence level and a `⏳` badge for pending-approval items or an "new (will request)" label for ingredients not yet in the dictionary. Clicking **Accept selected** attaches matched ingredients immediately and auto-submits pending ingredient requests for unmatched ones (which go through the existing superadmin approval flow).
- **Dish translations:** per-locale name + description stored in `dish_translations`; add/replace (upsert) and delete individual locales directly from the dish detail panel in the menu builder. Locale uses BCP-47 tags (e.g. `fr`, `vi`, `zh-Hant`).
- **Delete safeguards:** all delete operations require a confirmation dialog; cascading deletes are blocked at the UI level (menu → sections, section → dishes) with descriptive error messages.

## Ingredient catalog (superadmin only)

- **Route:** `/app/meta/ingredients` — non–superadmin users are redirected away.
- **Pending queue:** list requests from restaurants; **approve** (dictionary entry goes live) or **reject** with confirmation dialog.
- **Search ingredients:** debounced name search across all ingredients (approved + pending); each result shows edit, translations, and delete actions.
- **Edit ingredient:** update canonical name, description, allergen flag/group inline; `409` guard on name conflict.
- **Delete ingredient:** delete any ingredient (approved or pending) with confirmation; blocked server-side if still attached to dishes.
- **Ingredient translations:** per-locale name + description stored in `ingredient_translations`; click **Translations** on a search result to expand the panel — list existing, add/replace a locale, or delete with confirmation.
- **Ingredient media (search results):** click **Media** on any search result to expand an inline gallery — upload additional images/videos, reorder with Up/Down, and remove with confirmation dialog.
- **Add dictionary entry directly:** create an approved ingredient with optional **multiple** media files in one flow; remove gallery items with confirmation.

## Developer quality

- **Vitest** coverage for core flows (e.g. login, register, menu builder).

---

## Not implemented here (see `PROGRESS.md`)

- QR code display/download, rich restaurant profile editor, self-service role changes (superadmin is set in DB).
