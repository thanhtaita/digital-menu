-- Table comments: purpose and relationships (visible in PostgreSQL e.g. pg_catalog, DBeaver)
COMMENT ON TABLE "users" IS 'Application users. Owner of restaurants (via restaurants.owner_id); may have restrictions (user_restrictions) and admin access (restaurant_admins).';
--> statement-breakpoint
COMMENT ON TABLE "sessions" IS 'Session records for authenticated users. References users; cascade delete when user is removed.';
--> statement-breakpoint
COMMENT ON TABLE "restaurants" IS 'Restaurants (venues). Owned by users (owner_id). Referenced by menus and restaurant_admins.';
--> statement-breakpoint
COMMENT ON TABLE "menus" IS 'Menus belonging to a restaurant. Referenced by menu_sections.';
--> statement-breakpoint
COMMENT ON TABLE "menu_sections" IS 'Sections within a menu (e.g. Starters, Mains). Referenced by dishes.';
--> statement-breakpoint
COMMENT ON TABLE "dishes" IS 'Dishes (menu items) in a section. Ingredients are linked via dish_ingredients.';
--> statement-breakpoint
COMMENT ON TABLE "ingredients" IS 'Global ingredient catalog. Canonical names, optional FDC/nutrients, allergen info. Referenced by ingredient_aliases, dish_ingredients, user_restrictions.';
--> statement-breakpoint
COMMENT ON TABLE "ingredient_aliases" IS 'Alternative names for ingredients (e.g. i18n). One ingredient can have many aliases. References ingredients.';
--> statement-breakpoint
COMMENT ON TABLE "dish_ingredients" IS 'Junction table: which ingredients each dish contains (per-dish, optional/hidden flags). Links dishes to the global ingredients catalog.';
--> statement-breakpoint
COMMENT ON TABLE "user_restrictions" IS 'User dietary restrictions (allergy, dislike, diet). References users and optionally a specific ingredient; used for filtering/warnings.';
--> statement-breakpoint
COMMENT ON TABLE "restaurant_admins" IS 'Junction table: which users can administer which restaurants. References users and restaurants.';
