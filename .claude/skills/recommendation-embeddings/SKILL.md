---
name: recommendation-embeddings
description: Design of the pgvector semantic recommendation system (implemented DB/API layer + the not-yet-built embedding server) and the AI ingredient suggestion feature. Use when working on user_preferences/dish_embeddings/recommendations tables, apps/api/src/services/recommendation.ts, apps/api/src/services/ai-ingredient-suggestion.ts, or building the missing embedding server.
---

# Recommendation & embeddings architecture

This merges several design docs that used to live under `plans/` (`recommendation-system.md`, `unified-recommendation-system.md`, `embedding-recommendations.md`, `embedding-features.txt`, `ai-ingredient-suggestion.md`) into one reference. Two features share this skill because they're both AI-assisted matching problems against the ingredient/dish data, but they are otherwise independent:

1. **Semantic dish recommendations** (pgvector) - partially implemented, missing the embedding-generation service.
2. **AI ingredient suggestions** (Gemini/OpenAI) - Phase 1 implemented; see `CLAUDE.md` § Features implemented and the `api-routes` skill for the current route/contract. This skill only covers its *future* phases.

## 1. Semantic dish recommendations (pgvector)

### What's implemented today (this monorepo)

- **DB** (migration `0006_embeddings`): `user_preferences` (free-text preference per user), `dish_embeddings` (`vector(768)`, HNSW cosine index), `user_preference_embeddings` (`vector(768)`), `embedding_jobs` (audit log: entity type/id, status, model, timing), `recommendations` (shown results, similarity score, rank, session), `recommendation_feedback` (clicked/selected/dismissed).
- **Shared schemas**: `packages/shared/src/recommendations.ts` - preference/recommendation/feedback Zod schemas.
- **Fastify routes**: `apps/api/src/routes/preferences.ts` (`GET/PUT/DELETE /users/me/preferences`), `apps/api/src/routes/recommendations.ts` (`GET /users/me/recommendations`, `POST /recommendations/:id/feedback`, `GET /users/me/recommendations/history`). Full contract in the `api-routes` skill.
- **Service**: `apps/api/src/services/recommendation.ts` - runs the pgvector query directly:
  ```sql
  SELECT d.id, d.name, d.description, d.price, d.image_url,
         1 - (de.embedding <=> upe.embedding) AS similarity_score
  FROM dish_embeddings de
  JOIN dishes d ON d.id = de.dish_id
  JOIN user_preference_embeddings upe ON upe.preference_id = $preferenceId
  WHERE d.is_available = true
  ORDER BY de.embedding <=> upe.embedding
  LIMIT $limit;
  ```
  Uses `db.execute(sql\`...\`)` raw SQL since Drizzle's pgvector `<=>` operator support is limited. Stores top results in `recommendations` before returning.

### What's missing: the embedding-generation service

The vector tables are **populated by nothing today** - there's no service that actually calls an embedding model and writes to `dish_embeddings`/`user_preference_embeddings`. Until one exists, `GET /users/me/recommendations` will always return `202 EMBEDDING_PENDING`. This is the real remaining work, and it's intentionally **a separate service outside this monorepo** (a Python FastAPI app), not a `apps/*` package.

**Proposed architecture** (from `unified-recommendation-system.md`, the most current reconciliation of the earlier standalone plans against what's actually built):

```
Diner App → Fastify API (this repo)
  PUT  /users/me/preferences        (implemented)
  GET  /users/me/recommendations    (implemented, pgvector top-k)
       │
       ├─ on preference PUT/dish create-update: fire-and-forget
       │    POST http://EMBEDDING_SERVER_URL/embed/preferences/{id}
       │    POST http://EMBEDDING_SERVER_URL/embed/dishes/{id}
       │
       └─ on GET /recommendations, optionally:
            POST http://EMBEDDING_SERVER_URL/rank   (LightGBM re-scoring of pgvector candidates)
            falls back to pure pgvector ordering if the embedding server is unavailable
       │
FastAPI Embedding Server (separate repo/service, NOT in apps/*)
  POST /embed/dishes[/​:id]        — embed via Ollama (nomic-embed-text, 768-dim), upsert dish_embeddings
  POST /embed/preferences[/​:id]  — same for user_preferences → user_preference_embeddings
  POST /rank                      — LightGBM re-ranks pgvector candidates using extra features
  GET  /health, GET /embed/status
       │
PostgreSQL (same DB as Fastify) ←→ Ollama (nomic-embed-text, http://localhost:11434)
```

- **Dish embedding text**: `"{name}. {description}. Category: {section_name}. Price: {price}."`
- **Batching**: 20 items/batch, max 5 concurrent Ollama requests, failures logged to `embedding_jobs` and skipped (no full-batch abort).
- **LightGBM ranker** (optional re-ranking layer on top of pgvector retrieval): features are `retrieval_score`, `rating`, `order_count_log`, `price`, `is_promoted`, `hour_of_day`, `cuisine_match`. **Schema gap**: `dishes` has no `rating`/`order_count`/`is_promoted`/`cuisine` columns today - the ranker must default these to 0/neutral until real order-history data justifies a migration. Training uses synthetic labels (`rating*0.3 + order_count_log*0.2 + retrieval_score*0.4 + is_promoted*0.1`) as a placeholder until real interaction data exists.
- **Env var to add when building this**: `EMBEDDING_SERVER_URL` (default `http://localhost:8001`) on the Fastify side.
- Config for the embedding server itself: `DATABASE_URL` (same as Fastify), `OLLAMA_URL` (default `http://localhost:11434`), `EMBED_MODEL` (default `nomic-embed-text`), `BATCH_SIZE` (default `20`).

### Design decisions carried over from the superseded standalone plan

- Use the **real** `dishes` table via PostgreSQL, not a standalone `dishes.json` fixture.
- Rely on pgvector's HNSW index for retrieval; don't add a separate faiss `.index` file or `.npz` vector store - vectors belong in `dish_embeddings`.
- The FastAPI service should own only embedding generation + optional ranking; Fastify stays the user-facing API (`/api/v1/users/me/recommendations`), not FastAPI.
- If/when built, verify with: `dish_embeddings` row count > 0, a `PUT` preference followed by a `GET /recommendations` returning ranked (not `202`) results, and the dietary-restriction hard filter actually excluding restricted dishes in a test case.

### Diner-app UI (not built yet)

`apps/diner-app` has no UI for this - the API is ready but nothing calls it. If built: add `apiGetPreference`/`apiUpsertPreference`/`apiGetRecommendations` to `apps/diner-app/src/lib/api-client.ts`, plus a preference form + recommendation list component, likely integrated into `/profile` or the menu page (placement is a product decision, not yet made).

## 2. AI ingredient suggestions - future phases

Phase 1 (Gemini-based suggestion + pg_trgm fuzzy matching + auto-create pending ingredients) is implemented - see `CLAUDE.md` § Features implemented (`apps/api`) and the `api-routes` skill for the current `POST /dishes/suggest-ingredients` contract. The original plan's later phases, not yet built:

- **Phase 2 - enhanced matching**: check `ingredient_aliases` during matching (not just canonical name); build a small synonym dictionary (e.g. "scallion"/"green onion"/"spring onion"); only add pgvector semantic matching for ingredient names if fuzzy matching's false-negative rate proves too high (>20%) - not needed preemptively.
- **Phase 3 - learning/optimization**: an `ai_suggestion_feedback` table tracking accept/reject per suggestion, to eventually tune prompts or matching thresholds; restaurant-specific suggestion boosting (e.g. a Thai restaurant's existing menu nudges toward "fish sauce", "galangal"); a bulk "generate for all dishes without ingredients" batch job.
- **Rollout ideas from the original plan** (not implemented): a `FEATURE_AI_SUGGESTIONS_ENABLED` flag + restaurant allowlist for staged rollout, and an `ai_suggestion_logs` table for cost/usage tracking. Treat these as optional - the feature already shipped without them.
- **Longer-term ideas** (explicitly speculative): multilingual suggestion output, image-based suggestions from a dish photo, nutritional-data auto-population from USDA data, full recipe-step assistance, menu-wide analysis ("suggest popular dishes missing from my menu"). None of these have a concrete design - treat as product brainstorm, not a spec to implement from.
