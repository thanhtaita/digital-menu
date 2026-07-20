CREATE INDEX "dishes_name_trgm" ON "dishes" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "dishes_description_trgm" ON "dishes" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "restaurants_name_trgm" ON "restaurants" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "restaurants_description_trgm" ON "restaurants" USING gin ("description" gin_trgm_ops);