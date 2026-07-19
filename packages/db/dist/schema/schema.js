import { pgTable, serial, text, boolean, integer, numeric, jsonb, timestamp, pgEnum, index, uniqueIndex, vector } from "drizzle-orm/pg-core";
// Enums
export const userRoleEnum = pgEnum("user_role", ["diner", "restaurant_admin", "superadmin"]);
export const restrictionTypeEnum = pgEnum("restriction_type", ["allergy", "dislike", "diet"]);
export const restrictionSeverityEnum = pgEnum("restriction_severity", ["block", "warn"]);
/** Pending = submitted by a restaurant; approved = in the official dictionary search. */
export const ingredientApprovalStatusEnum = pgEnum("ingredient_approval_status", ["pending", "approved"]);
/** Gallery item type for dish_media (images and videos). */
export const dishMediaKindEnum = pgEnum("dish_media_kind", ["image", "video"]);
/** Review state for a candidate USDA FoodData Central match against an ingredient. */
export const fdcMatchStatusEnum = pgEnum("fdc_match_status", ["pending", "accepted", "rejected"]);
/** Review state for a candidate diet-compatibility tag against an ingredient. */
export const dietTagStatusEnum = pgEnum("diet_tag_status", ["pending", "accepted", "rejected"]);
/**
 * Users and auth
 * - users: Core user accounts. Referenced by sessions, restaurants (owner), user_restrictions, restaurant_admins.
 * - sessions: Active sessions; each row belongs to one user.
 */
/** Application users. Owner of restaurants (via restaurants.owner_id); may have restrictions (user_restrictions) and admin access (restaurant_admins). */
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("diner"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio")
});
/** Session records for authenticated users. References users; cascade delete when user is removed. */
export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});
/**
 * Restaurants and menu hierarchy
 * - restaurants: One per venue; owned by a user. Has many menus.
 * - menus: Belong to a restaurant; have many menu_sections.
 * - menu_sections: Sections within a menu; have many dishes.
 * - dishes: Menu items in a section; linked to ingredients via dish_ingredients.
 */
/** Restaurants (venues). Owned by users (owner_id). Referenced by menus and restaurant_admins. */
export const restaurants = pgTable("restaurants", {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    ownerId: integer("owner_id")
        .notNull()
        .references(() => users.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true)
}, (table) => ({
    slugIdx: uniqueIndex("restaurants_slug_unique").on(table.slug)
}));
/** Menus belonging to a restaurant. Referenced by menu_sections. */
export const menus = pgTable("menus", {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
        .notNull()
        .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0)
});
/** Sections within a menu (e.g. Starters, Mains). Referenced by dishes. */
export const menuSections = pgTable("menu_sections", {
    id: serial("id").primaryKey(),
    menuId: integer("menu_id")
        .notNull()
        .references(() => menus.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull().default(0)
});
/** Dishes (menu items) in a section. Ingredients are linked via dish_ingredients. */
export const dishes = pgTable("dishes", {
    id: serial("id").primaryKey(),
    sectionId: integer("section_id")
        .notNull()
        .references(() => menuSections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0)
});
/** Ordered images and videos for a dish (public URLs: /uploads/... or https://). */
export const dishMedia = pgTable("dish_media", {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id")
        .notNull()
        .references(() => dishes.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: dishMediaKindEnum("kind").notNull(),
    displayOrder: integer("display_order").notNull().default(0)
}, (table) => ({
    dishIdIdx: index("dish_media_dish_id_idx").on(table.dishId)
}));
/**
 * Ingredient knowledge layer (global catalog).
 * - ingredients: Canonical ingredients (FDC, nutrients, allergen flags). Referenced by ingredient_aliases, dish_ingredients, user_restrictions.
 * - ingredient_aliases: Alternative names per ingredient (i18n).
 * - dish_ingredients: Junction table: which ingredients each dish contains (restaurant-specific usage of global ingredients).
 * - ingredient_fdc_candidates: Review queue for USDA FoodData Central match candidates (see the fdc-nutrition-backfill skill).
 * - ingredient_diet_candidates: Review queue for LLM-proposed diet-compatibility tags (see the seed-and-ingredient-data skill).
 */
/** Global ingredient catalog. Canonical names, optional FDC/nutrients, allergen info. Referenced by ingredient_aliases, dish_ingredients, user_restrictions. */
export const ingredients = pgTable("ingredients", {
    id: serial("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    fdcId: integer("fdc_id"),
    foodCategory: text("food_category"),
    nutrients: jsonb("nutrients").$type(),
    isCommonAllergen: boolean("is_common_allergen").notNull().default(false),
    commonAllergenGroup: text("common_allergen_group"),
    /**
     * Per-diet compatibility, keyed by the DietType values in @digital-menu/shared (vegan, vegetarian,
     * pescatarian, halal, kosher, gluten_free, dairy_free, nut_free). true = compatible, false =
     * incompatible, missing key = no signal yet (never treated as a violation - see restriction-engine).
     * Populated by the diet-tagging backfill (services/diet-tagging.ts), never hand-edited.
     */
    dietTags: jsonb("diet_tags").$type(),
    approvalStatus: ingredientApprovalStatusEnum("approval_status").notNull().default("approved"),
    requestedByRestaurantId: integer("requested_by_restaurant_id").references(() => restaurants.id, {
        onDelete: "set null"
    })
}, (table) => ({
    canonicalNameIdx: uniqueIndex("ingredients_canonical_name_unique").on(table.canonicalName),
    slugIdx: uniqueIndex("ingredients_slug_unique").on(table.slug)
}));
/** Ordered images/videos for an ingredient (same URL semantics as dish_media). */
export const ingredientMedia = pgTable("ingredient_media", {
    id: serial("id").primaryKey(),
    ingredientId: integer("ingredient_id")
        .notNull()
        .references(() => ingredients.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: dishMediaKindEnum("kind").notNull(),
    displayOrder: integer("display_order").notNull().default(0)
}, (table) => ({
    ingredientIdIdx: index("ingredient_media_ingredient_id_idx").on(table.ingredientId)
}));
/** Alternative names for ingredients (e.g. i18n). One ingredient can have many aliases. References ingredients. */
export const ingredientAliases = pgTable("ingredient_aliases", {
    id: serial("id").primaryKey(),
    ingredientId: integer("ingredient_id")
        .notNull()
        .references(() => ingredients.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    languageCode: text("language_code").default("en")
}, (table) => ({
    ingredientAliasUnique: uniqueIndex("ingredient_aliases_ingredient_id_alias_unique").on(table.ingredientId, table.alias)
}));
/** Junction table: which ingredients each dish contains (per-dish, optional/hidden flags). Links dishes to the global ingredients catalog. */
export const dishIngredients = pgTable("dish_ingredients", {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id")
        .notNull()
        .references(() => dishes.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id")
        .notNull()
        .references(() => ingredients.id, { onDelete: "restrict" }),
    isOptional: boolean("is_optional").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0)
}, (table) => ({
    dishIngredientUnique: uniqueIndex("dish_ingredients_dish_id_ingredient_id_unique").on(table.dishId, table.ingredientId)
}));
/**
 * Candidate matches from the `fdc` reference schema (see resources/fdc-data/import) against an
 * ingredient, pending superadmin review. Not a live join target - once accepted, the needed nutrients are
 * denormalized into ingredients.nutrients and ingredients.fdc_id is set; this table only tracks the review
 * queue/audit trail, never read at request time.
 */
export const ingredientFdcCandidates = pgTable("ingredient_fdc_candidates", {
    id: serial("id").primaryKey(),
    ingredientId: integer("ingredient_id")
        .notNull()
        .references(() => ingredients.id, { onDelete: "cascade" }),
    fdcId: integer("fdc_id").notNull(),
    fdcDescription: text("fdc_description").notNull(),
    // fdc.food.data_type at match time (e.g. "foundation_food", "sr_legacy_food", "survey_fndds_food") -
    // lets a reviewer tell sources apart. Nullable: candidates queued before this column existed have none.
    fdcDataType: text("fdc_data_type"),
    score: numeric("score", { precision: 5, scale: 4 }).notNull(),
    status: fdcMatchStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at")
}, (table) => ({
    ingredientFdcUnique: uniqueIndex("ingredient_fdc_candidates_ingredient_id_fdc_id_unique").on(table.ingredientId, table.fdcId),
    statusIdx: index("ingredient_fdc_candidates_status_idx").on(table.status)
}));
/**
 * Candidate diet-compatibility tags proposed by the LLM-assisted backfill (see services/diet-tagging.ts),
 * pending superadmin review. High-confidence tags are applied directly to ingredients.diet_tags and never
 * appear here; this table only holds ambiguous (medium/low confidence) proposals awaiting a decision.
 */
export const ingredientDietCandidates = pgTable("ingredient_diet_candidates", {
    id: serial("id").primaryKey(),
    ingredientId: integer("ingredient_id")
        .notNull()
        .references(() => ingredients.id, { onDelete: "cascade" }),
    dietType: text("diet_type").notNull(),
    compatible: boolean("compatible").notNull(),
    confidence: text("confidence").notNull(),
    reasoning: text("reasoning"),
    status: dietTagStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at")
}, (table) => ({
    ingredientDietTypeUnique: uniqueIndex("ingredient_diet_candidates_ingredient_id_diet_type_unique").on(table.ingredientId, table.dietType),
    statusIdx: index("ingredient_diet_candidates_status_idx").on(table.status)
}));
/** User dietary restrictions (allergy, dislike, diet). References users and optionally a specific ingredient; used for filtering/warnings. */
export const userRestrictions = pgTable("user_restrictions", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    restrictionType: restrictionTypeEnum("restriction_type").notNull(),
    ingredientId: integer("ingredient_id").references(() => ingredients.id, {
        onDelete: "set null"
    }),
    dietType: text("diet_type"),
    severity: restrictionSeverityEnum("severity").notNull().default("block")
});
/** Junction table: which users can administer which restaurants. References users and restaurants. */
export const restaurantAdmins = pgTable("restaurant_admins", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    restaurantId: integer("restaurant_id")
        .notNull()
        .references(() => restaurants.id, { onDelete: "cascade" })
}, (table) => ({
    userRestaurantUnique: uniqueIndex("restaurant_admins_user_id_restaurant_id_unique").on(table.userId, table.restaurantId)
}));
/**
 * Translation tables
 * - dish_translations: Per-locale name + description for a dish.
 * - ingredient_translations: Per-locale name + description for an ingredient.
 * The root table holds the default (source) language values as a fallback.
 * Locale uses BCP-47 tags (e.g. "en", "fr", "vi", "zh-Hant").
 */
/** Translations for dish name and description, keyed by (dish_id, locale). */
export const dishTranslations = pgTable("dish_translations", {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id")
        .notNull()
        .references(() => dishes.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    description: text("description")
}, (table) => ({
    dishLocaleUnique: uniqueIndex("dish_translations_dish_id_locale_unique").on(table.dishId, table.locale),
    dishIdIdx: index("dish_translations_dish_id_idx").on(table.dishId)
}));
/** Translations for ingredient canonical name and description, keyed by (ingredient_id, locale). */
export const ingredientTranslations = pgTable("ingredient_translations", {
    id: serial("id").primaryKey(),
    ingredientId: integer("ingredient_id")
        .notNull()
        .references(() => ingredients.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    description: text("description")
}, (table) => ({
    ingredientLocaleUnique: uniqueIndex("ingredient_translations_ingredient_id_locale_unique").on(table.ingredientId, table.locale),
    ingredientIdIdx: index("ingredient_translations_ingredient_id_idx").on(table.ingredientId)
}));
/**
 * Embedding & recommendation layer (Phase 2).
 * - userPreferences: free-text preference description per user (one row per user).
 * - dishEmbeddings: 768-dim nomic-embed-text vectors for dishes (written by FastAPI server).
 * - userPreferenceEmbeddings: 768-dim vectors for user preference texts.
 * - embeddingJobs: audit log for embedding pipeline runs.
 * - recommendations: ranked dish results shown to a user in a session.
 * - recommendationFeedback: click/select/dismiss interactions on recommendations.
 */
export const userPreferences = pgTable("user_preferences", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    preferenceText: text("preference_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
    userIdUnique: uniqueIndex("user_preferences_user_id_unique").on(table.userId)
}));
export const dishEmbeddings = pgTable("dish_embeddings", {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    modelName: text("model_name").notNull(),
    embeddedAt: timestamp("embedded_at").defaultNow().notNull()
}, (table) => ({
    dishIdUnique: uniqueIndex("dish_embeddings_dish_id_unique").on(table.dishId),
    vectorIdx: index("dish_embeddings_vector_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
}));
export const userPreferenceEmbeddings = pgTable("user_preference_embeddings", {
    id: serial("id").primaryKey(),
    preferenceId: integer("preference_id").notNull().references(() => userPreferences.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    modelName: text("model_name").notNull(),
    embeddedAt: timestamp("embedded_at").defaultNow().notNull()
}, (table) => ({
    preferenceIdUnique: uniqueIndex("user_preference_embeddings_preference_id_unique").on(table.preferenceId)
}));
export const embeddingJobs = pgTable("embedding_jobs", {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    status: text("status").notNull(),
    modelName: text("model_name").notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at")
});
export const recommendations = pgTable("recommendations", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    dishId: integer("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
    similarityScore: numeric("similarity_score", { precision: 6, scale: 4 }).notNull(),
    rank: integer("rank").notNull(),
    sessionId: text("session_id"),
    shownAt: timestamp("shown_at").defaultNow().notNull()
});
export const recommendationFeedback = pgTable("recommendation_feedback", {
    id: serial("id").primaryKey(),
    recommendationId: integer("recommendation_id").notNull().references(() => recommendations.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actionAt: timestamp("action_at").defaultNow().notNull()
});
/**
 * Social layer (Phase 1)
 * - user_follows: directed follow graph between users.
 * - posts: user-authored posts, optionally tagged to a restaurant.
 * - post_media: ordered media gallery for a post.
 * - post_likes: per-user likes on posts.
 * - post_comments: threaded comments on posts (one level deep via parentCommentId).
 */
export const userFollows = pgTable("user_follows", {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("following_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
    followerFollowingUnique: uniqueIndex("user_follows_follower_following_unique").on(table.followerId, table.followingId),
    followerIdIdx: index("user_follows_follower_id_idx").on(table.followerId),
    followingIdIdx: index("user_follows_following_id_idx").on(table.followingId)
}));
export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    restaurantId: integer("restaurant_id").references(() => restaurants.id, { onDelete: "set null" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
    authorIdIdx: index("posts_author_id_idx").on(table.authorId),
    restaurantIdIdx: index("posts_restaurant_id_idx").on(table.restaurantId),
    createdAtIdx: index("posts_created_at_idx").on(table.createdAt)
}));
export const postMedia = pgTable("post_media", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: dishMediaKindEnum("kind").notNull(),
    displayOrder: integer("display_order").notNull().default(0)
}, (table) => ({
    postIdIdx: index("post_media_post_id_idx").on(table.postId)
}));
export const postLikes = pgTable("post_likes", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
    postUserUnique: uniqueIndex("post_likes_post_user_unique").on(table.postId, table.userId),
    postIdIdx: index("post_likes_post_id_idx").on(table.postId)
}));
export const postComments = pgTable("post_comments", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentCommentId: integer("parent_comment_id").references(() => postComments.id, {
        onDelete: "cascade"
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
    postIdIdx: index("post_comments_post_id_idx").on(table.postId),
    authorIdIdx: index("post_comments_author_id_idx").on(table.authorId)
}));
/**
 * AI chat layer
 * - aiChatSessions: one session per (user, restaurant); stores a rolling conversation_summary.
 * - aiChatMessages: individual turns (role: user | assistant) in a session.
 */
export const aiChatSessions = pgTable("ai_chat_sessions", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    restaurantId: integer("restaurant_id").notNull().references(() => restaurants.id, { onDelete: "cascade" }),
    conversationSummary: text("conversation_summary"),
    likedDishNames: jsonb("liked_dish_names").$type(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
    userRestaurantUnique: uniqueIndex("ai_chat_sessions_user_restaurant_unique").on(table.userId, table.restaurantId)
}));
export const aiChatMessages = pgTable("ai_chat_messages", {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull().references(() => aiChatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    recommendations: jsonb("recommendations").$type(),
    createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
    sessionIdIdx: index("ai_chat_messages_session_id_idx").on(table.sessionId)
}));
