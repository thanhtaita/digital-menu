CREATE TYPE "public"."diet_tag_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "ingredient_diet_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_id" integer NOT NULL,
	"diet_type" text NOT NULL,
	"compatible" boolean NOT NULL,
	"confidence" text NOT NULL,
	"reasoning" text,
	"status" "diet_tag_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "diet_tags" jsonb;--> statement-breakpoint
ALTER TABLE "ingredient_diet_candidates" ADD CONSTRAINT "ingredient_diet_candidates_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_diet_candidates_ingredient_id_diet_type_unique" ON "ingredient_diet_candidates" USING btree ("ingredient_id","diet_type");--> statement-breakpoint
CREATE INDEX "ingredient_diet_candidates_status_idx" ON "ingredient_diet_candidates" USING btree ("status");