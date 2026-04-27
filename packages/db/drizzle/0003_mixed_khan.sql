CREATE TYPE "public"."dish_media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TABLE "dish_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"dish_id" integer NOT NULL,
	"url" text NOT NULL,
	"kind" "dish_media_kind" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish_media" ADD CONSTRAINT "dish_media_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dish_media_dish_id_idx" ON "dish_media" USING btree ("dish_id");--> statement-breakpoint
INSERT INTO "dish_media" ("dish_id", "url", "kind", "display_order")
SELECT "id", "image_url", 'image'::"dish_media_kind", 0
FROM "dishes"
WHERE "image_url" IS NOT NULL AND trim("image_url") <> '';
