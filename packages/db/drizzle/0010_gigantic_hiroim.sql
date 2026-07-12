CREATE TYPE "public"."fdc_match_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "ingredient_fdc_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_id" integer NOT NULL,
	"fdc_id" integer NOT NULL,
	"fdc_description" text NOT NULL,
	"score" numeric(5, 4) NOT NULL,
	"status" "fdc_match_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ingredient_fdc_candidates" ADD CONSTRAINT "ingredient_fdc_candidates_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_fdc_candidates_ingredient_id_fdc_id_unique" ON "ingredient_fdc_candidates" USING btree ("ingredient_id","fdc_id");--> statement-breakpoint
CREATE INDEX "ingredient_fdc_candidates_status_idx" ON "ingredient_fdc_candidates" USING btree ("status");