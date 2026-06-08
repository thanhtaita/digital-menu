# Embedding & Recommendation System — Implementation Plan

## Context

The restaurant menu platform needs a semantic recommendation engine so diners can receive personalized dish suggestions based on natural-language preference descriptions. The approach uses local LLM embeddings (Ollama / nomic-embed-text) to generate 768-dimensional vectors for both dishes and user preferences, then uses pgvector cosine similarity to rank matches.

Phase 1 (Gemini-based AI ingredient suggestions) is already complete. This plan implements Phase 2: the embedding pipeline and recommendation layer.

Architecture decision: the FastAPI embedding server will live in a **separate repository** (not this monorepo). This plan therefore covers two scopes:
- **A. This monorepo** — DB schema, Drizzle migrations, Fastify API endpoints, shared Zod schemas
- **B. Separate repo spec** — what the FastAPI server must implement (acts as a contract)

---

## Part A: This Monorepo Changes

### Step 1 — Enable pgvector & Add New Tables (DB Migration)

**Files to create/modify:**
- `packages/db/src/schema/schema.ts` — add new table definitions
- `packages/db/drizzle/0006_embeddings.sql` — new migration

**pgvector setup (migration must include):**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**New tables to add to schema.ts (Drizzle definitions):**

```typescript
// User free-text preference description
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  preferenceText: text("preference_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Embedding vectors for dishes (768-dim, nomic-embed-text)
export const dishEmbeddings = pgTable("dish_embeddings", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }).unique(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  modelName: text("model_name").notNull(),
  embeddedAt: timestamp("embedded_at").defaultNow().notNull(),
});

// Embedding vectors for user preferences (768-dim)
export const userPreferenceEmbeddings = pgTable("user_preference_embeddings", {
  id: serial("id").primaryKey(),
  preferenceId: integer("preference_id").notNull().references(() => userPreferences.id, { onDelete: "cascade" }).unique(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  modelName: text("model_name").notNull(),
  embeddedAt: timestamp("embedded_at").defaultNow().notNull(),
});

// Audit/debug log for embedding jobs
export const embeddingJobs = pgTable("embedding_jobs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),       // 'dish' | 'user_preference'
  entityId: integer("entity_id").notNull(),
  status: text("status").notNull(),                // 'success' | 'failure'
  modelName: text("model_name").notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
});

// Recommendation records shown to users
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dishId: integer("dish_id").notNull().references(() => dishes.id, { onDelete: "cascade" }),
  similarityScore: numeric("similarity_score", { precision: 6, scale: 4 }).notNull(),
  rank: integer("rank").notNull(),
  sessionId: text("session_id"),
  shownAt: timestamp("shown_at").defaultNow().notNull(),
});

// User interactions with recommendations
export const recommendationFeedback = pgTable("recommendation_feedback", {
  id: serial("id").primaryKey(),
  recommendationId: integer("recommendation_id").notNull().references(() => recommendations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),                // 'clicked' | 'selected' | 'dismissed'
  actionAt: timestamp("action_at").defaultNow().notNull(),
});
```

**Index to add (for fast vector search):**
```sql
CREATE INDEX dish_embeddings_vector_idx ON dish_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

---

### Step 2 — Shared Zod Schemas

**File:** `packages/shared/src/recommendations.ts` (new file)

Schemas to define:
- `updateUserPreferenceSchema` — `{ preferenceText: z.string().min(10).max(2000) }`
- `userPreferenceResponseSchema` — preference object with userId, text, hasEmbedding flag
- `recommendationSchema` — dish id/name/description + similarityScore + rank + matchedSectionId + restaurantId
- `recommendationsResponseSchema` — array of recommendations + metadata (basedOn, generatedAt, preferenceEmbedded)
- `recommendationFeedbackSchema` — `{ action: z.enum(["clicked", "selected", "dismissed"]) }`

**File:** `packages/shared/src/index.ts` — export new schemas

---

### Step 3 — Fastify API Routes

#### 3a. User Preferences Routes
**File:** `apps/api/src/routes/preferences.ts` (new)

```
GET    /users/me/preferences   → return stored preference text + hasEmbedding flag
PUT    /users/me/preferences   → upsert preferenceText (body: updateUserPreferenceSchema)
DELETE /users/me/preferences   → delete preference (cascade removes embedding)
```

Auth: `requireAuth` only — user owns their own preferences, no restaurant-access check needed.

#### 3b. Recommendations Routes
**File:** `apps/api/src/routes/recommendations.ts` (new)

```
GET  /users/me/recommendations          → return ranked dishes
     Query params: ?restaurantId=&limit=10
POST /recommendations/:id/feedback      → record click/select/dismiss
GET  /users/me/recommendations/history  → past recommendations (paginated)
```

**Recommendation query logic** in `apps/api/src/services/recommendation.ts`:
```sql
SELECT d.id, d.name, d.description, d.price, d.image_url,
       1 - (de.embedding <=> upe.embedding) AS similarity_score
FROM dish_embeddings de
JOIN dishes d ON d.id = de.dish_id
JOIN user_preference_embeddings upe ON upe.preference_id = $preferenceId
WHERE d.is_available = true
  -- AND d.section_id IN (...) if restaurantId filter applied
ORDER BY de.embedding <=> upe.embedding  -- cosine distance ASC = most similar first
LIMIT $limit;
```

Use `db.execute(sql\`...\`)` for raw SQL since Drizzle ORM has limited pgvector `<=>` operator support.

Store top results in the `recommendations` table before returning.

#### 3c. Register in `apps/api/src/app.ts`
Import and register both new route modules under `/api/v1/` prefix.

---

### Step 4 — Update Documentation

- `IMPLEMENTED_ROUTES.md` — add all new routes with auth notes
- `apps/api/FEATURES.md` — add "User Preferences" and "Semantic Recommendations" sections
- `apps/diner-app/FEATURES.md` — note endpoints exist for future diner UI

---

## Part B: FastAPI Embedding Server (Separate Repo — Contract)

**Tech stack:** FastAPI, psycopg2-binary, httpx, pgvector Python client

**Database:** Same PostgreSQL as Fastify. Reads `user_preferences` and `dishes`; writes to `dish_embeddings`, `user_preference_embeddings`, `embedding_jobs`.

**Ollama:** `http://localhost:11434/api/embed` · Model: `nomic-embed-text` (768-dim)

**Dish text combination strategy:**
```
"{name}. {description}. Category: {section_name}. Price: {price}."
```

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Check Ollama connectivity |
| POST | /embed/dishes | Embed all unembedded dishes (batch) |
| POST | /embed/dishes/{id} | Embed a single dish |
| POST | /embed/preferences | Embed all unembedded user preferences (batch) |
| POST | /embed/preferences/{id} | Embed a single user preference |
| GET | /embed/status | Recent embedding_jobs history |

**Batch processing rules:**
- Batch size: 20 items
- On failure: log to `embedding_jobs`, continue (no full abort)
- Max 5 concurrent Ollama requests

**Environment variables:**
- `DATABASE_URL` — same connection string as Fastify
- `OLLAMA_URL` — default `http://localhost:11434`
- `EMBED_MODEL` — default `nomic-embed-text`
- `BATCH_SIZE` — default `20`

---

## Execution Order

1. DB migration — enable pgvector, 6 new tables, HNSW index
2. Drizzle schema update — `packages/db/src/schema/schema.ts`
3. Shared Zod schemas — `packages/shared/src/recommendations.ts` + export from index
4. Fastify preferences routes — `apps/api/src/routes/preferences.ts`
5. Fastify recommendation service — `apps/api/src/services/recommendation.ts`
6. Fastify recommendations routes — `apps/api/src/routes/recommendations.ts`
7. Register routes in `apps/api/src/app.ts`
8. Update docs — `IMPLEMENTED_ROUTES.md`, `apps/api/FEATURES.md`, `apps/diner-app/FEATURES.md`
9. *(Separate repo)* FastAPI embedding server

---

## Verification

### DB layer
```sql
\d dish_embeddings           -- expect vector(768) column
\d dish_embeddings_vector_idx -- expect hnsw index
```

### Preferences API
```bash
curl -X PUT http://localhost:3002/api/v1/users/me/preferences \
  -H "Content-Type: application/json" -b "session_id=..." \
  -d '{"preferenceText": "I love spicy Thai food with lots of fresh herbs"}'

curl http://localhost:3002/api/v1/users/me/preferences -b "session_id=..."
```

### Recommendations API (requires at least one embedding job to have run)
```bash
curl "http://localhost:3002/api/v1/users/me/recommendations?limit=5" -b "session_id=..."
```

### Feedback
```bash
curl -X POST http://localhost:3002/api/v1/recommendations/1/feedback \
  -H "Content-Type: application/json" -b "session_id=..." \
  -d '{"action": "clicked"}'
```

### Edge cases
- No stored preference → 400 with clear message
- Preference exists but no embedding yet → 202 with "embedding pending" message
- User cannot access another user's preferences (auth guard)
- Deleted dish cascades out of `dish_embeddings` and `recommendations`
