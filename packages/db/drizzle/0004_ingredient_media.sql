CREATE TABLE "ingredient_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_id" integer NOT NULL,
	"url" text NOT NULL,
	"kind" "dish_media_kind" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_media" ADD CONSTRAINT "ingredient_media_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_media_ingredient_id_idx" ON "ingredient_media" USING btree ("ingredient_id");--> statement-breakpoint
INSERT INTO "ingredient_media" ("ingredient_id", "url", "kind", "display_order")
SELECT "id", "image_url", 'image'::"dish_media_kind", 0
FROM "ingredients"
WHERE "image_url" IS NOT NULL AND trim("image_url") <> '';
