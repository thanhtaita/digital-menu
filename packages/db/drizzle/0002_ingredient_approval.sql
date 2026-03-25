CREATE TYPE "public"."ingredient_approval_status" AS ENUM('pending', 'approved');--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "approval_status" "ingredient_approval_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "requested_by_restaurant_id" integer;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_requested_by_restaurant_id_restaurants_id_fk" FOREIGN KEY ("requested_by_restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
