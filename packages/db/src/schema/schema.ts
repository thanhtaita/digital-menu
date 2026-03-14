import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  pgEnum,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["diner", "restaurant_admin", "superadmin"]);
export const restrictionTypeEnum = pgEnum("restriction_type", ["allergy", "dislike", "diet"]);
export const restrictionSeverityEnum = pgEnum("restriction_severity", ["block", "warn"]);

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
  avatarUrl: text("avatar_url")
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
export const restaurants = pgTable(
  "restaurants",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    isActive: boolean("is_active").notNull().default(true)
  },
  (table) => ({
    slugIdx: uniqueIndex("restaurants_slug_unique").on(table.slug)
  })
);

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

/**
 * Ingredient knowledge layer (global catalog).
 * - ingredients: Canonical ingredients (FDC, nutrients, allergen flags). Referenced by ingredient_aliases, dish_ingredients, user_restrictions.
 * - ingredient_aliases: Alternative names per ingredient (i18n).
 * - dish_ingredients: Junction table: which ingredients each dish contains (restaurant-specific usage of global ingredients).
 */

/** Global ingredient catalog. Canonical names, optional FDC/nutrients, allergen info. Referenced by ingredient_aliases, dish_ingredients, user_restrictions. */
export const ingredients = pgTable(
  "ingredients",
  {
    id: serial("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    fdcId: integer("fdc_id"),
    foodCategory: text("food_category"),
    nutrients: jsonb("nutrients").$type<Record<string, unknown>>(),
    isCommonAllergen: boolean("is_common_allergen").notNull().default(false),
    commonAllergenGroup: text("common_allergen_group")
  },
  (table) => ({
    canonicalNameIdx: uniqueIndex("ingredients_canonical_name_unique").on(table.canonicalName),
    slugIdx: uniqueIndex("ingredients_slug_unique").on(table.slug)
  })
);

/** Alternative names for ingredients (e.g. i18n). One ingredient can have many aliases. References ingredients. */
export const ingredientAliases = pgTable(
  "ingredient_aliases",
  {
    id: serial("id").primaryKey(),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    languageCode: text("language_code").default("en")
  },
  (table) => ({
    ingredientAliasUnique: uniqueIndex("ingredient_aliases_ingredient_id_alias_unique").on(
      table.ingredientId,
      table.alias
    )
  })
);

/** Junction table: which ingredients each dish contains (per-dish, optional/hidden flags). Links dishes to the global ingredients catalog. */
export const dishIngredients = pgTable(
  "dish_ingredients",
  {
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
  },
  (table) => ({
    dishIngredientUnique: uniqueIndex("dish_ingredients_dish_id_ingredient_id_unique").on(
      table.dishId,
      table.ingredientId
    )
  })
);

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
export const restaurantAdmins = pgTable(
  "restaurant_admins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" })
  },
  (table) => ({
    userRestaurantUnique: uniqueIndex("restaurant_admins_user_id_restaurant_id_unique").on(
      table.userId,
      table.restaurantId
    )
  })
);

// Insert types for use in seed/API
export type NewIngredient = typeof ingredients.$inferInsert;
export type NewIngredientAlias = typeof ingredientAliases.$inferInsert;

