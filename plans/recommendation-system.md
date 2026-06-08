I need you to build a restaurant menu recommendation system inside this existing project.
Use Python. Follow each phase in order and confirm completion before moving to the next.

---

## Prerequisites — verify before starting

Check that the following are available in the environment:

- Python 3.11+
- Ollama is installed and running (run: ollama list to confirm)
- nomic-embed-text model is pulled (run: ollama pull nomic-embed-text if not present)
- If anything is missing, stop and tell me what needs to be fixed before continuing

---

## Phase 1 — Sample Data

Create data/dishes.json with 20 realistic restaurant dishes.
Each dish must have:

- id (string, e.g. "dish_001")
- name (string)
- description (string, 1-2 sentences)
- tags (list of strings, e.g. ["savory", "crispy", "spicy"])
- cuisine (string, e.g. "italian")
- dietary (list, values from: meat, seafood, vegetarian, vegan)
- price (float)
- rating (float, 1-5)
- order_count (int)
- is_promoted (bool)

Make the 20 dishes varied across cuisines and dietary types.
Confirm once file is created and show me the first 3 entries.

---

## Phase 2 — Embedding Store (src/embeddings.py)

Build an EmbeddingStore class using Ollama + nomic-embed-text (768-dim vectors, no API key needed).

It must do:

1. generate_dish_embeddings(dishes)
   - For each dish, embed this string: "{name}. {description}. Tags: {tags joined by comma}"
   - Returns dict of dish_id -> vector (list of floats)

2. embed_preference(preference_text)
   - Embeds a raw preference string directly
   - Returns a single vector

3. save(path) — saves all vectors to a .npz file using numpy

4. load(path) — loads vectors from .npz and restores the dict

Install dependency: pip install ollama
Vector dimension is 768. Add a module-level comment noting this so it's obvious if the model ever changes.
Confirm once done and show me a sample vector shape.

---

## Phase 3 — Retrieval Index (src/retrieval.py)

Build a RetrieverIndex class using faiss-cpu for fast cosine similarity search.

It must do:

1. build(dish_ids, vectors)
   - Normalize all vectors using faiss.normalize_L2
   - Build a faiss IndexFlatIP (inner product on normalized vectors = cosine similarity)
   - Store dish_ids internally for result mapping

2. search(query_vector, top_k=50)
   - Normalize query vector before searching
   - Returns list of dicts: [{dish_id, retrieval_score}, ...]
   - Scores are cosine similarity values (0-1)

3. save(path) / load(path) — persist and restore the faiss index + dish_id mapping

Install dependency: pip install faiss-cpu
Confirm once done and run a quick sanity check: embed one dish description manually, search the index, and show me the top 3 results.

---

## Phase 4 — Ranker (src/ranker.py)

Build a Ranker class using LightGBM that re-scores retrieval candidates using richer features.

Features to assemble per candidate (joined from dishes.json):

- retrieval_score — from Phase 3
- rating — raw float
- order_count_log — log1p(order_count)
- price — raw float
- is_promoted — 0 or 1
- hour_of_day — from context dict (0-23)
- cuisine_match — 1 if context preferred_cuisine matches dish cuisine, else 0

It must do:

1. assemble_features(candidates, dishes_lookup, context) -> np.ndarray
   - candidates is the output of retrieval search
   - dishes_lookup is a dict of dish_id -> dish object
   - context is: { hour_of_day: int, preferred_cuisine: str, dietary_restrictions: list }

2. generate_synthetic_labels(candidates, dishes_lookup)
   - Scores each candidate using: (rating _ 0.3) + (order_count_log _ 0.2) + (retrieval_score _ 0.4) + (is_promoted _ 0.1)
   - Add comment: # TODO: replace with real order history data

3. train(X, y) — fit a LGBMRanker with objective="lambdarank"

4. predict(X) -> list of floats — returns ranking scores

5. save(path) / load(path) — persist and restore the model with pickle

Install dependency: pip install lightgbm
Confirm once done.

---

## Phase 5 — Pipeline (src/pipeline.py)

Build a RecommendationPipeline class that wires Phase 2 + 3 + 4 together into a single call.

It must do:

1. **init**(embedding_store, retriever, ranker, dishes_lookup)

2. recommend(preference_text, context, top_n=10)
   Step 1 — embed preference_text into a query vector
   Step 2 — retrieval: search top_k=50 candidates from the faiss index
   Step 3 — assemble features for all 50 candidates
   Step 4 — rank: score all candidates, sort descending
   Step 5 — apply hard filters: remove dishes that conflict with context dietary_restrictions
   Step 6 — return top_n results as list of dicts:
   { rank, dish_id, name, cuisine, tags, price, rating, retrieval_score, rank_score }

Context shape: { hour_of_day: int, preferred_cuisine: str, dietary_restrictions: list[str] }
Confirm once done.

---

## Phase 6 — Seed Script (scripts/seed_embeddings.py)

Create a runnable script that sets up all artifacts from scratch. It must:

1. Load data/dishes.json
2. Generate embeddings for all dishes via EmbeddingStore
3. Build the faiss index via RetrieverIndex
4. Train the ranker on synthetic labels
5. Save all artifacts to data/artifacts/:
   - dish_embeddings.npz
   - faiss.index
   - ranker.pkl
6. Print a step-by-step summary as it runs, and a final confirmation with artifact sizes

Run the script after creating it and show me the output.
If anything fails, fix it before continuing.

---

## Phase 7 — API (src/api.py)

Build a FastAPI app that serves the pipeline.

POST /recommend
Request:
{
"preference_text": "I want something spicy and meaty",
"context": {
"hour_of_day": 19,
"dietary_restrictions": [],
"preferred_cuisine": "italian"
},
"top_n": 5
}
Response:
{
"recommendations": [
{
"rank": 1,
"dish_id": "dish_003",
"name": "...",
"cuisine": "...",
"tags": [...],
"price": 18.0,
"rating": 4.6,
"retrieval_score": 0.87,
"rank_score": 0.92
}
],
"pipeline_version": "1.0.0"
}

GET /health
Returns: { "status": "ok", "artifacts_loaded": true }

- Load all artifacts on startup using FastAPI lifespan
- All artifact paths loaded from environment variables with sensible defaults
- Use python-dotenv for env loading

Install dependencies: pip install fastapi uvicorn python-dotenv
After creating the file, start the server and run a test curl request against /recommend.
Show me the response. Fix anything that fails.

---

## Phase 8 — Smoke Test

Once the API is running, run these three test cases and show me the full response for each:

1. { "preference_text": "spicy meat dish", "context": { "hour_of_day": 19, "dietary_restrictions": [], "preferred_cuisine": "mexican" }, "top_n": 3 }
2. { "preference_text": "light vegetarian lunch", "context": { "hour_of_day": 12, "dietary_restrictions": ["meat", "seafood"], "preferred_cuisine": "mediterranean" }, "top_n": 3 }
3. { "preference_text": "rich creamy comfort food", "context": { "hour_of_day": 20, "dietary_restrictions": [], "preferred_cuisine": "italian" }, "top_n": 3 }

Verify that dietary_restrictions filtering is working correctly in test case 2 (no meat or seafood should appear).
Report any issues found.
