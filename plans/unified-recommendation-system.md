# Unified Recommendation System Plan

## Context

The project already has a complete pgvector-based recommendation foundation:
- **Migration 0006** applied: `dish_embeddings` (vector 768, HNSW index), `user_preference_embeddings`, `embedding_jobs`, `recommendations`, `recommendation_feedback`, `user_preferences` tables are live in PostgreSQL.
- **Fastify API routes** implemented: `GET/PUT/DELETE /users/me/preferences`, `GET /users/me/recommendations` (pgvector cosine similarity), `POST /recommendations/:id/feedback`.
- **Shared Zod schemas** in `packages/shared/src/recommendations.ts`: preference, recommendation, feedback schemas.
- **Recommendation service** in `apps/api/src/services/recommendation.ts`: pgvector `<=>` operator, joins dishes/sections/menus, stores results in `recommendations` table.

**What's missing:** The Python embedding server that actually _populates_ the vector tables. Without it the `dish_embeddings` and `user_preference_embeddings` tables are empty so recommendations always return `embedding_pending`.

**What `plans/recommendation-system.md` proposes that conflicts with the existing architecture:**
- Standalone `dishes.json` → we have real dishes in PostgreSQL; use those.
- faiss `.index` artifact → redundant with pgvector's HNSW index (already defined in migration 0006).
- `.npz` numpy file store → redundant; vectors belong in `dish_embeddings` table.
- FastAPI serving `/recommend` as the user-facing endpoint → Fastify already owns that at `/api/v1/users/me/recommendations`.

**What to keep from `recommendation-system.md`:**
- EmbeddingStore class (Ollama + nomic-embed-text, 768-dim) — but writes to DB, not files.
- LightGBM ranker — re-scores pgvector candidates using richer features.
- RecommendationPipeline — wires pgvector retrieval + LightGBM.
- Seed script — embeds all real dishes.
- FastAPI app — but as an internal service, not end-user API.

---

## Unified Architecture

```
Diner App (Next.js)
  PUT /api/v1/users/me/preferences
  GET /api/v1/users/me/recommendations
       │
  Fastify API (TypeScript)
  ├── On PUT /preferences: calls POST http://embedding-server/embed/preferences/{id}
  ├── On dish create/update: calls POST http://embedding-server/embed/dishes/{id}
  └── On GET /recommendations:
        1. pgvector top-k via <=> operator  (already implemented)
        2. POST http://embedding-server/rank  (new: LightGBM re-scoring)
        3. Return top_n re-ranked results
       │
  FastAPI Embedding Server  (apps/embedding-server/)
  ├── POST /embed/dishes            — batch embed all dishes
  ├── POST /embed/dishes/{id}       — embed single dish
  ├── POST /embed/preferences/{id}  — embed user preference
  ├── POST /rank                    — LightGBM re-rank pgvector candidates
  └── GET  /health
       │
  PostgreSQL + pgvector
  ├── dish_embeddings  (HNSW index, vector_cosine_ops)
  ├── user_preference_embeddings
  └── embedding_jobs  (audit log)
       │
  Ollama  (nomic-embed-text, 768-dim)
```

---

## Implementation Phases

### Phase 1 — FastAPI Embedding Server scaffold (`apps/embedding-server/`)

**Directory layout:**
```
apps/embedding-server/
  src/
    config.py        # env vars (DATABASE_URL, OLLAMA_URL, EMBED_MODEL, RANKER_MODEL_PATH)
    db.py            # psycopg2 pool; queries: fetch_dishes, fetch_dish, fetch_preference, upsert_embedding, write_job
    embeddings.py    # EmbeddingStore: generate_dish_embedding(dish), generate_preference_embedding(text), post to Ollama
    ranker.py        # Ranker: assemble_features, generate_synthetic_labels, train, predict, save, load
    pipeline.py      # RecommendationPipeline: takes pgvector candidates + context → runs ranker → returns ranked list
    main.py          # FastAPI app, lifespan (load ranker), routes
  scripts/
    seed_embeddings.py   # embed all dishes + train ranker on synthetic labels
  requirements.txt   # fastapi uvicorn psycopg2-binary ollama lightgbm numpy python-dotenv
  .env.example
```

**`db.py` key queries:**
- `fetch_all_dishes()` — `SELECT id, name, description, price FROM dishes JOIN menu_sections ... JOIN menus ... JOIN restaurants` (gets section/cuisine context for embedding text)
- `fetch_dish(dish_id)` — same, single dish
- `fetch_preference(preference_id)` — `SELECT preference_text FROM user_preferences WHERE id = $1`
- `upsert_dish_embedding(dish_id, vector, model)` — INSERT ... ON CONFLICT DO UPDATE in `dish_embeddings`
- `upsert_preference_embedding(preference_id, vector, model)` — INSERT ... ON CONFLICT DO UPDATE in `user_preference_embeddings`
- `write_embedding_job(entity_type, entity_id, status, model, error)` — insert into `embedding_jobs`

**`embeddings.py`:**
- Dish text format: `"{name}. {description}. Category: {section_name}. Price: ${price}."` (matches embedding-recommendations.md spec)
- Calls `ollama.embeddings(model="nomic-embed-text", prompt=text)` — 768-dim output
- Module-level comment: `# nomic-embed-text produces 768-dim vectors; update dish_embeddings table DDL if model changes`

**`main.py` routes:**
```
POST /embed/dishes            → embed all dishes in DB (batch, 20 at a time)
POST /embed/dishes/{dish_id}  → embed single dish; upsert dish_embeddings
POST /embed/preferences/{id}  → embed preference text; upsert user_preference_embeddings
POST /rank                    → body: { candidates: [{dish_id, retrieval_score}], dishes_lookup: {...}, context: {...} }
                               → returns: [{dish_id, rank_score}]
GET  /health                  → { status: "ok", ranker_loaded: bool }
```

---

### Phase 2 — LightGBM Ranker (`apps/embedding-server/src/ranker.py`)

Follows `recommendation-system.md` Phase 4 spec exactly, but operates on DB data instead of dishes.json.

**Features per candidate:**
| Feature | Source |
|---|---|
| `retrieval_score` | from pgvector candidate |
| `rating` | not in current schema — use `0.0` placeholder until added |
| `order_count_log` | not in current schema — use `0.0` placeholder |
| `price` | `dishes.price` |
| `is_promoted` | not in current schema — use `0` placeholder |
| `hour_of_day` | from context dict |
| `cuisine_match` | 1 if context.preferred_cuisine matches restaurant name heuristic |

> **Schema gap note:** `dishes` table lacks `rating`, `order_count`, `is_promoted`, `cuisine` fields that `recommendation-system.md` assumes. The ranker must gracefully default missing fields to 0/neutral. These can be added to the schema in a future migration if real order history is captured.

**`Ranker` class methods:**
```python
assemble_features(candidates, dishes_lookup, context) → np.ndarray  # 7 features
generate_synthetic_labels(candidates, dishes_lookup)                 # (rating*0.3)+(order_log*0.2)+(retrieval*0.4)+(promoted*0.1)
train(X, y)          # LGBMRanker(objective="lambdarank")
predict(X)           # → list[float]
save(path) / load(path)   # pickle
```

---

### Phase 3 — RecommendationPipeline (`apps/embedding-server/src/pipeline.py`)

```python
class RecommendationPipeline:
    def rank_candidates(self, candidates, dishes_lookup, context, top_n=10):
        # Step 1: assemble features for all candidates
        # Step 2: predict rank scores
        # Step 3: filter hard dietary restrictions (context.dietary_restrictions)
        # Step 4: sort descending by rank_score, return top_n
        # Returns: [{dish_id, name, cuisine, tags, price, retrieval_score, rank_score, rank}]
```

This is only the ranking half; retrieval is done in Fastify via pgvector.

---

### Phase 4 — Seed Script (`apps/embedding-server/scripts/seed_embeddings.py`)

Runnable script that bootstraps all artifacts:
1. Call `GET /health` to verify server is up
2. Call `POST /embed/dishes` to embed all dishes (prints progress per batch)
3. Fetch all embedded dishes from `dish_embeddings` table
4. Train ranker on synthetic labels using those embeddings
5. Save ranker model to `apps/embedding-server/data/ranker.pkl`
6. Print final summary with row counts and file sizes

Run: `python scripts/seed_embeddings.py`

---

### Phase 5 — Fastify Integration (modify existing routes)

**File: `apps/api/src/routes/preferences.ts`**
- After successful `PUT /users/me/preferences` → fire-and-forget HTTP call to `POST http://${EMBEDDING_SERVER_URL}/embed/preferences/${preferenceId}`
- On failure: log warning, do not fail the user request (embedding is async)

**File: `apps/api/src/routes/dishes.ts`** (or wherever dishes are created/updated)
- After successful dish create/update → fire-and-forget `POST http://${EMBEDDING_SERVER_URL}/embed/dishes/${dishId}`

**File: `apps/api/src/services/recommendation.ts`**
- After pgvector top-k retrieval, if `EMBEDDING_SERVER_URL` is set and ranker is loaded:
  - Call `POST http://${EMBEDDING_SERVER_URL}/rank` with candidates + context
  - Merge rank scores back; sort by rank_score instead of similarity_score
- If embedding server is unavailable → fall back to pure pgvector ordering (no change to existing behavior)

**Config:** Add `EMBEDDING_SERVER_URL` env var (default `http://localhost:8001`) to `apps/api/.env.example`.

---

### Phase 6 — Diner App UI (minimal, unblocking)

**File: `apps/diner-app/src/lib/api-client.ts`** — add:
- `apiGetPreference()` — GET /users/me/preferences
- `apiUpsertPreference(text)` — PUT /users/me/preferences
- `apiGetRecommendations(restaurantId?, limit?)` — GET /users/me/recommendations

**New component: `apps/diner-app/src/components/recommendations/`**
- `PreferenceForm.tsx` — text area (10-2000 chars) with save button; shows current preference
- `RecommendationList.tsx` — renders ranked dish cards; handles `no_preference` and `embedding_pending` states
- Integrate into existing diner profile page or menu page (one location TBD by user)

---

### Phase 7 — Smoke Test

Three curl tests against FastAPI `/rank` and Fastify `/recommendations` after seeding:

1. Spicy meat: preference "spicy meat dish", context `{ hour_of_day: 19, preferred_cuisine: "mexican", dietary_restrictions: [] }`
2. Vegetarian lunch: "light vegetarian lunch", `{ hour_of_day: 12, preferred_cuisine: "mediterranean", dietary_restrictions: ["meat", "seafood"] }` — verify no meat/seafood in results
3. Comfort food: "rich creamy comfort food", `{ hour_of_day: 20, preferred_cuisine: "italian", dietary_restrictions: [] }`

---

## Critical Files

| File | Action |
|---|---|
| `apps/embedding-server/src/main.py` | Create |
| `apps/embedding-server/src/embeddings.py` | Create |
| `apps/embedding-server/src/ranker.py` | Create |
| `apps/embedding-server/src/pipeline.py` | Create |
| `apps/embedding-server/src/db.py` | Create |
| `apps/embedding-server/src/config.py` | Create |
| `apps/embedding-server/requirements.txt` | Create |
| `apps/embedding-server/scripts/seed_embeddings.py` | Create |
| `apps/api/src/routes/preferences.ts` | Modify — add embedding trigger |
| `apps/api/src/routes/dishes.ts` | Modify — add embedding trigger |
| `apps/api/src/services/recommendation.ts` | Modify — add optional ranker call |
| `apps/diner-app/src/lib/api-client.ts` | Modify — add 3 preference/recommendation functions |
| `apps/diner-app/src/components/recommendations/` | Create — PreferenceForm + RecommendationList |
| `IMPLEMENTED_ROUTES.md` | Update — add embedding server routes |
| `apps/api/FEATURES.md` | Update — note LightGBM re-ranking |
| `apps/diner-app/FEATURES.md` | Update — note recommendation UI |

---

## Prerequisites (verify before starting)

- Python 3.11+ available
- `ollama list` shows `nomic-embed-text` (or run `ollama pull nomic-embed-text`)
- PostgreSQL running with pgvector extension (migration 0006 already applied)
- `lightgbm`, `psycopg2-binary`, `ollama`, `fastapi`, `uvicorn`, `numpy`, `python-dotenv` installable via pip

---

## Schema Gaps (do not block on these)

The `recommendation-system.md` plan assumes `rating`, `order_count`, `is_promoted` fields on dishes. The current `dishes` table has none of these. Options:
- **Default to 0** — ranker still works; retrieval_score dominates (recommended, ship now)
- **Add migration** — add nullable `rating float`, `order_count int`, `is_promoted bool` to `dishes` table (future phase, when real order data exists)

---

## Verification

1. Start Ollama: `ollama serve`
2. Start embedding server: `cd apps/embedding-server && uvicorn src.main:app --port 8001`
3. Run seed: `python scripts/seed_embeddings.py`
4. Verify `dish_embeddings` table has rows: `SELECT count(*) FROM dish_embeddings;`
5. Set a preference via diner app or curl: `PUT /api/v1/users/me/preferences`
6. Embedding server auto-embeds the preference
7. Call `GET /api/v1/users/me/recommendations` — should return ranked dishes
8. Run 3 smoke tests from Phase 7
