-- ai_chat_sessions.liked_dish_names and ai_chat_messages.recommendations were already
-- applied to the dev database out-of-band (outside any tracked migration) before this
-- migration was generated. Using IF NOT EXISTS so this migration is a safe no-op here,
-- while still being the source of truth for a fresh `db:reset` + migrate to reproduce
-- the same schema from scratch.
ALTER TABLE "ai_chat_sessions" ADD COLUMN IF NOT EXISTS "liked_dish_names" jsonb;--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD COLUMN IF NOT EXISTS "recommendations" jsonb;
