-- Translation tables for dishes and ingredients.
-- Each table stores per-locale overrides for translatable text fields.
-- The root record (dishes.name, ingredients.canonical_name, etc.) acts as
-- the default/fallback when no translation exists for the requested locale.
-- Locale format: BCP-47 tags, e.g. "en", "fr", "vi", "zh-Hant".

CREATE TABLE "dish_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"dish_id" integer NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "ingredient_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_id" integer NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "dish_translations"
  ADD CONSTRAINT "dish_translations_dish_id_dishes_id_fk"
  FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ingredient_translations"
  ADD CONSTRAINT "ingredient_translations_ingredient_id_ingredients_id_fk"
  FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "dish_translations_dish_id_locale_unique"
  ON "dish_translations" USING btree ("dish_id", "locale");
--> statement-breakpoint
CREATE INDEX "dish_translations_dish_id_idx"
  ON "dish_translations" USING btree ("dish_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_translations_ingredient_id_locale_unique"
  ON "ingredient_translations" USING btree ("ingredient_id", "locale");
--> statement-breakpoint
CREATE INDEX "ingredient_translations_ingredient_id_idx"
  ON "ingredient_translations" USING btree ("ingredient_id");
