-- Phase 2: pgvector embedding pipeline for semantic dish recommendations.
-- Enables the vector extension and adds tables for user preferences,
-- dish/preference embeddings, embedding job audit log, and recommendation tracking.

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"preference_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"dish_id" integer NOT NULL,
	"embedding" vector(768) NOT NULL,
	"model_name" text NOT NULL,
	"embedded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preference_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"preference_id" integer NOT NULL,
	"embedding" vector(768) NOT NULL,
	"model_name" text NOT NULL,
	"embedded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"status" text NOT NULL,
	"model_name" text NOT NULL,
	"error_message" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"dish_id" integer NOT NULL,
	"similarity_score" numeric(6, 4) NOT NULL,
	"rank" integer NOT NULL,
	"session_id" text,
	"shown_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"action_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dish_embeddings" ADD CONSTRAINT "dish_embeddings_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_preference_embeddings" ADD CONSTRAINT "user_preference_embeddings_preference_id_user_preferences_id_fk" FOREIGN KEY ("preference_id") REFERENCES "public"."user_preferences"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_unique" ON "user_preferences" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "dish_embeddings_dish_id_unique" ON "dish_embeddings" USING btree ("dish_id");
--> statement-breakpoint

CREATE UNIQUE INDEX "user_preference_embeddings_preference_id_unique" ON "user_preference_embeddings" USING btree ("preference_id");
--> statement-breakpoint
CREATE INDEX "dish_embeddings_vector_idx" ON "dish_embeddings" USING hnsw ("embedding" vector_cosine_ops);
