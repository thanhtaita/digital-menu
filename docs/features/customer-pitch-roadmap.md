# Customer Pitch Readiness: Feature Audit & Roadmap

Last updated: 2026-07-12.
Purpose: track what's actually demo-ready today versus what needs work before pitching the digital-menu product to restaurant customers, and prioritize the gaps.
This is a living document.
Update it as items ship or priorities shift.

---

## 1. What's demo-ready today

- Menu browsing with allergen/diet-aware badges and per-diner restriction filtering (`apps/diner-app`, `restriction-engine.ts`).
- Ingredient detail bottom sheets with nutrition pills, sourced from USDA FoodData Central.
- Full admin menu authoring: menu/section/dish CRUD, media galleries, ingredient tagging, QR code generation (`apps/admin-portal/src/routes/menu-builder.tsx`).
- AI chat dish recommender grounded in the live menu and the diner's own allergies/diets, streaming, session memory (`apps/api/src/lib/ai/`, `.claude/skills/ai-chat-architecture/SKILL.md`).
This is the strongest differentiator in the product and should anchor the pitch.

---

## 2. Scaffolded but invisible to diners

These have real, working backend and admin-side pieces, but nothing surfaces to the end diner yet.
Closing these is higher leverage than building net-new features, since most of the cost is already sunk.

### Translation / i18n
- `dish_translations` and `ingredient_translations` tables exist and are fully migrated (`packages/db/drizzle/0005_translations.sql`).
- Admin portal has a working per-dish/per-ingredient translation CRUD panel.
- API has working CRUD endpoints for both.
- Missing: no i18n framework in `apps/diner-app` (no locale routing, no language switcher), and `public-menu.ts` never reads from the translation tables.
- Verdict: roughly 80% done on the write path, 0% done on the read path.

### Semantic / embedding-based recommendations
- pgvector schema and retrieval API exist (`user_preferences`, `dish_embeddings`, `recommendations`).
- Missing: no embedding-generation service (likely where the sibling `digital-menu-embeddings` project plugs in), and no diner-app UI calls the endpoint at all.
- Verdict: currently dead code end to end; the endpoint always returns "pending."

---

## 3. Social: built the wrong slice

A full Instagram-style layer exists: follow another user, post photos, like, comment, threaded replies, profile feed (`apps/api/src/routes/social-*.ts`, `apps/diner-app/src/components/social/*`).
It works end-to-end but was explicitly out of the original MVP scope, and it is currently untested and unthrottled (no rate limiting on any social route) - a real risk if it were to get spammed during a live customer demo.

What's actually missing is the social proof that helps someone decide what to order, which is what "social" should mean for a menu product:

- Ratings / reviews (restaurant or dish level): not started, zero schema or code.
- Favorites / save a dish or restaurant: not started.
- Share a dish/menu link externally (with OG image) to drive word-of-mouth: not started.
- Referral program: not started.
- Follow a restaurant (as opposed to follow a user): not started - `user_follows` only links user-to-user.

---

## 4. Not built at all

Flagging these so the pitch doesn't accidentally overpromise:

- Ordering, cart, checkout, payments.
- POS integration/sync.
- Item variants/modifiers (size, spice level, add-ons) - only a boolean "optional ingredient" flag exists, not real customization.
- Daypart/scheduled menus (breakfast/lunch/dinner) - menus have no time-window concept, just a flat `isPublished` boolean.
- Bulk pricing tools.
- Any analytics/popularity dashboard for restaurant owners (no view counts, order counts, or "most viewed dish" signal anywhere).

---

## 5. Prioritized roadmap

Given the current focus is on improving the menu itself and helping diners make better decisions (rather than growing the social feed), in priority order:

1. **Finish translation end-to-end.** Add locale routing and a language switcher to the diner app, and serve `dish_translations`/`ingredient_translations` from `public-menu.ts`. Highest leverage: the hard (schema, admin authoring) part is already done.
2. **Real ratings/favorites**, not more social-feed features. A star rating per dish/restaurant and a save/favorite button. This is the "social" that actually helps decision-making, and it can later feed the recommender.
3. **Shareable dish/menu links with OG images.** Cheap to build, and it's a genuine organic-growth story to tell restaurant owners in the pitch.
4. **Surface "you might also like" directly on the menu page**, not only inside the chat. Requires finishing the embedding pipeline. Puts the AI differentiator in front of every diner passively, not just the ones who open chat.
5. **Item modifiers/variants** (size, spice, add-ons). Table stakes; prospects will likely ask about this live. Worth having even without a full cart/checkout.
6. **Basic dish-level view/popularity signal in the admin dashboard.** Restaurant owners buying a menu platform want an ROI story; "here's what diners actually look at" is a strong close.
7. **Daypart/scheduled menus** (breakfast/lunch/dinner). Common expectation, currently structurally impossible.

### Before any live customer demo
Add rate limiting to the social routes (follows/posts/likes/comments currently have none).
A bot, or a nervous prospect double-clicking "like," could produce an embarrassing moment mid-demo.

---

## 6. New feature ideas worth considering (not yet scoped)

- AI-generated dish descriptions from a photo + ingredient list, and AI photo enhancement for low-quality restaurant-submitted images - extends the existing AI ingredient-suggestion pattern already in the admin portal.
- LLM-based auto-translate as a first pass, with human review, instead of fully manual per-locale typing - builds directly on the existing translation tables and the AI provider abstraction already in use for chat.
- Inline "ask the menu" chat widget embedded directly on the menu page, rather than requiring navigation to a separate chat route, to increase discovery of the flagship AI feature.
- Auto-computed macro/nutrition summary badges per dish (e.g. "high protein," "under 500 cal") - the nutrient data already exists, this is a display/aggregation layer.
