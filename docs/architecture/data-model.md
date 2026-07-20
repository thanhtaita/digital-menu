# Database schema overview

Source of truth: `packages/db/src/schema/schema.ts`. Grouped by domain:

- **Users & auth**: `users` (role enum, bcrypt hash, avatar/bio), `sessions`.
- **Restaurant/menu hierarchy**: `restaurants` (slug-unique tenant root) → `menus` (`isPublished`) → `menu_sections` → `dishes` (+ `dish_media` galleries).
- **Ingredient dictionary** (global, not restaurant-scoped): `ingredients` (approval workflow, allergen flags, jsonb `nutrients` backfilled from `fdc.*`, jsonb `diet_tags` per-diet compatibility map - see the `seed-and-ingredient-data` skill and [`docs/goals/dietary-safety-and-nutrition/`](../goals/dietary-safety-and-nutrition/README.md)), `ingredient_media`, `ingredient_aliases` (lang-tagged), `dish_ingredients` (junction, restrict-on-delete), `ingredient_fdc_candidates` (FDC match review queue), `ingredient_diet_candidates` (diet-tag review queue).
- **Restrictions & admin**: `user_restrictions` (allergy/dislike/diet, block/warn severity), `restaurant_admins` (multi-admin junction).
- **Translations**: `dish_translations`, `ingredient_translations` - locale-keyed overlays, separate from `ingredient_aliases`.
- **Embeddings/recommendations** (legacy/parallel to AI chat): `user_preferences`, `dish_embeddings`, `user_preference_embeddings`, `embedding_jobs`, `recommendations`, `recommendation_feedback`.
- **Social layer**: `user_follows`, `posts`, `post_media`, `post_likes`, `post_comments` (one level of reply threading via self-referencing `parentCommentId`).
- **AI chat**: `ai_chat_sessions` (one per user × restaurant, rolling `conversationSummary`, `likedDishNames` jsonb), `ai_chat_messages` (role, content, `recommendations` jsonb on assistant turns).

For the migration workflow itself (schema.ts → drizzle-kit generate → migrate, and the tracking-discipline incident that shaped it), see the `db-migration` skill.

## See also

- [`docs/architecture/system-overview.md`](./system-overview.md) - monorepo layout and request-handling conventions
- [`docs/architecture/fdc-reference-data.md`](./fdc-reference-data.md) - the separate `fdc` reference schema `ingredients.nutrients`/`fdcId` are backfilled from
