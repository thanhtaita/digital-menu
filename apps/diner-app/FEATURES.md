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

## Taste preferences (`/profile` — Preferences section)

- **Auto-generates** a preference text from the user's saved dietary restrictions (diet type, allergies, dislikes).
- **Editable textarea** lets users append personal notes (e.g. "I love spicy food and prefer small plates") on top of the auto-generated summary. Min 10 / max 2000 characters.
- **Save / Update / Remove** via `PUT /users/me/preferences` and `DELETE /users/me/preferences`.
- Stored `preferenceText` feeds the semantic recommendation embedding pipeline.
- "Refresh from restrictions" button regenerates the auto-summary when restrictions have changed.

## Restriction engine and dish badges

- On `/r/[slug]`, when logged in, each dish is evaluated against the user's allergy/dislike restrictions.
- **Blocked dish** (contains a `block`-severity ingredient): card highlighted red + "Contains allergen" badge.
- **Warned 2dish** (contains a `warn`-severity ingredient): card highlighted amber + "Contains disliked ingredient" badge.
- **Ingredient pills** that match a restriction are highlighted red for quick identification.
- Diet-type restrictions are stored on the profile but not yet applied to dish filtering (Phase 2).

## Semantic recommendations (API ready, UI not yet built)

- **API endpoints exist** for personalized dish recommendations based on free-text preference descriptions (e.g. "I love spicy Thai food"). See `IMPLEMENTED_ROUTES.md` for `GET /users/me/recommendations` and related routes.
- **UI not yet implemented** — a future "For You" page or widget will call these endpoints to surface ranked dishes per user.

## Social layer (`/u`, `/feed`, `/posts`, `/r/[slug]?tab=posts`)

- **Public user profiles** (`/u/[userId]`) — avatar (or procedural gradient fallback), display name, bio, follower/following counts, follow/unfollow button (hidden on own profile or when logged out), post grid.
- **Social feed** (`/feed`, auth required) — chronological posts from followed users + own posts; "Load more" cursor-based pagination.
- **Post detail** (`/posts/[postId]`) — media carousel (images + videos), like count, threaded comment section with reply support; comments and replies loaded client-side.
- **Restaurant posts tab** (`/r/[slug]?tab=posts`) — community posts tagged to a restaurant; "Write a post" composer for logged-in users; tab switcher between Menu and Posts.
- **Post composer** — textarea + optional photo attachment (up to 5 images); posts are created first then media uploaded sequentially.
- **Like toggle** — optimistic UI on `PostCard`; requires login.
- **Comment threading** — top-level comments with one level of replies; reply form inline per comment.
- **Follow button** — optimistic follower count update; shows only for other users when logged in.
- **Site header** updated — "Feed" nav link for logged-in users; display name now links to `/u/[userId]`.

## AI Recommendations Chat (`/r/[slug]/chat`)

- **Dedicated chat page** accessible via the "AI Picks" tab on any restaurant menu page.
- **Conversational interface:** ask anything about the menu (mood, cravings, dietary needs) and receive personalized dish recommendations.
- **Context-aware:** Gemini sees the full published menu (dish names, prices, descriptions) + the user's saved preference text and dietary restrictions.
- **Recommendations panel:** each assistant response may include 1–5 highlighted dish cards below the message, with a brief reason for each pick.
- **Conversation persistence:** session is stored server-side; re-opening the page resumes where you left off (no starting from scratch on revisit).
- **Auto-summarization:** when a session grows long (>20 messages), older turns are summarized into a short context paragraph, keeping the experience fast without losing context.
- **Prompt chips:** empty-state shows suggested starter prompts ("What's popular?", "Something light", etc.).
- **Clear conversation** button resets the session completely.
- Requires login; redirects to `/login` when unauthenticated.

## Not implemented here (see `PROGRESS.md`)

- Diet-type dish filtering, Playwright E2E, user restriction sync/caching.
- Social explore/trending page (Phase 2).

