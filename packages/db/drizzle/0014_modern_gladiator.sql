CREATE TABLE "ai_content_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"field" text NOT NULL,
	"locale" text NOT NULL,
	"source_hash" text NOT NULL,
	"translated_value" text NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_content_translations_entity_field_locale_unique" ON "ai_content_translations" USING btree ("entity_type","entity_id","field","locale");--> statement-breakpoint
CREATE INDEX "ai_content_translations_entity_idx" ON "ai_content_translations" USING btree ("entity_type","entity_id");