# AI-Powered Ingredient Suggestion Feature Plan

**Created:** 2026-04-30
**Status:** Planning
**Target App:** `apps/admin-portal`

---

## 1. Feature Overview

### What it does
When a restaurant admin creates or edits a dish in the menu builder, they can provide:
- **Dish name** (required, already exists)
- **Dish description** (optional, already exists) - enhanced to capture cuisine type, regional variant, preparation method
- **Context prompt** (new, optional) - additional hints like "Vietnamese version", "with extra vegetables", "spicy variant"

An AI model analyzes this input and automatically suggests a list of ingredients likely to be in the dish. The admin can then:
- **Accept all** suggestions (auto-attach to dish)
- **Accept some** suggestions (cherry-pick which ingredients to add)
- **Reject all** and manually search (fallback to current flow)
- **Still manually add** more ingredients after accepting suggestions

For suggested ingredients that don't exist in the database:
- System automatically creates **pending ingredient requests**
- Follows existing superadmin approval workflow (already implemented)
- Admin is notified which ingredients are pending vs approved

### Why it's valuable
- **Saves time:** Eliminates repetitive manual ingredient searching for common dishes
- **Improves accuracy:** AI can suggest ingredients admins might forget
- **Maintains quality:** Still uses existing approval flow for new ingredients
- **Reduces friction:** Especially helpful for restaurants with large menus

---

## 2. User Experience Flow

### 2.1 Enhanced Dish Creation Form

**Current state:**
```
[Dish Name Input]
[Price Input]
[Description Textarea]
[Image Upload]
[Ingredient Search & Attach]
```

**New state:**
```
[Dish Name Input] *
[Price Input]
[Description Textarea] - with helpful placeholder
  "e.g., Traditional Vietnamese pho with rice noodles,
   slow-cooked beef broth, and fresh herbs"

[AI Context (Optional)]
  "Add details to improve suggestions: cuisine type,
   regional variant, preparation style, dietary modifications"

[🤖 Generate Ingredient Suggestions] Button
  - Only enabled when dish name exists
  - Shows loading state during AI call

[Ingredient Suggestions Panel] - appears after generation
  ✓ [Suggestion 1] (approved)
  ✓ [Suggestion 2] (pending approval) ⏳
  ✓ [Suggestion 3] (approved)
  ✗ [Suggestion 4] (approved)

  [Accept Selected (3)] [Reject All]

[Manual Ingredient Search] - always available below
  "Search for more ingredients or add manually"
```

### 2.2 Interaction Flow

1. **Admin enters dish details**
   - Name: "Pad Thai"
   - Description: "Stir-fried rice noodles with tamarind sauce"
   - Context: "Thai street food style, with shrimp"

2. **Admin clicks "Generate Ingredient Suggestions"**
   - Button shows spinner
   - API call to `/api/v1/dishes/suggest-ingredients`
   - Takes 2-4 seconds

3. **System displays suggestions**
   ```
   Suggested Ingredients (8 found):
   ✓ Rice noodles (approved)
   ✓ Tamarind paste (approved)
   ✓ Shrimp (approved)
   ✓ Bean sprouts (approved)
   ✓ Peanuts (approved)
   ✓ Fish sauce (pending approval) ⏳
   ✓ Lime (approved)
   ✓ Egg (approved)

   [Accept All (8)] [Accept Selected (8)] [Reject All]
   ```

4. **Admin reviews and selects**
   - Can uncheck any suggestions
   - Pending ingredients clearly marked with icon
   - Tooltip explains pending status

5. **Admin accepts selected**
   - Approved ingredients: immediately attached to dish
   - Pending ingredients:
     - Created as pending requests (restaurant_id tagged)
     - Attached to dish once created
     - Admin sees notification: "2 ingredients pending superadmin approval"

6. **Admin can still manually add more**
   - Search box remains below
   - Can add ingredients AI missed

---

## 3. Technical Architecture

### 3.1 AI Model Selection

**Recommended: OpenAI GPT-4o-mini or GPT-4o**

**Rationale:**
- **Accuracy:** GPT-4 models have excellent food/cuisine knowledge
- **Cost-effective:** GPT-4o-mini is $0.15/1M input tokens, $0.60/1M output tokens
- **Structured output:** Supports JSON mode for reliable parsing
- **Latency:** ~2-3 seconds for typical requests
- **Simple integration:** Official SDK with TypeScript support

**Alternative: Anthropic Claude 3.5 Sonnet**
- Similar accuracy and cost
- Excellent at structured extraction
- Choice depends on preference/existing accounts

**Not recommended for MVP:**
- Self-hosted models (LLaMA, Mistral): Requires GPU infrastructure, harder to maintain
- Embedding-based retrieval: Overcomplicated for this use case

### 3.2 Database Architecture

**Recommended: PostgreSQL + pg_trgm (already in use)**

**Rationale:**
- ✅ Already using PostgreSQL with `pg_trgm` for fuzzy ingredient search
- ✅ No additional infrastructure needed
- ✅ Ingredient matching can use existing search logic
- ✅ Simple SQL queries for matching AI suggestions to existing ingredients

**PostgreSQL approach:**
```sql
-- Find existing ingredient by canonical name (fuzzy match)
SELECT id, canonical_name, slug, status
FROM ingredients
WHERE
  status = 'approved'
  AND similarity(canonical_name, 'tamarind paste') > 0.6
ORDER BY similarity(canonical_name, 'tamarind paste') DESC
LIMIT 1;
```

**Optional enhancement (Phase 2): pgvector extension**
- Add semantic search for better ingredient matching
- Store embeddings of ingredient names/descriptions
- Match AI-suggested ingredients using cosine similarity
- Example: "cilantro" matches "fresh coriander" (synonym)
- **Only add if fuzzy matching proves insufficient**

**Why NOT a separate vector database (Pinecone, Weaviate, etc.):**
- ❌ Adds infrastructure complexity
- ❌ Extra cost and maintenance
- ❌ Overkill for ingredient matching (hundreds/thousands of items, not millions)
- ❌ Fuzzy text matching with pg_trgm is sufficient for MVP

---

## 4. Implementation Plan

### Phase 1: Core AI Integration (Recommended first sprint)

**Scope:** Basic AI suggestion without complex matching

#### 4.1 Backend: New API Route

**File:** `apps/api/src/routes/ai-suggestions.ts`

**Endpoint:** `POST /api/v1/dishes/suggest-ingredients`

**Request body (Zod schema in `packages/shared`):**
```typescript
{
  dishName: string;          // required
  description?: string;      // optional
  contextPrompt?: string;    // optional, e.g., "Vietnamese style"
  cuisineType?: string;      // optional, e.g., "Thai", "Italian"
}
```

**Response:**
```typescript
{
  suggestions: [
    {
      suggestedName: string;        // AI-generated name
      matchedIngredient?: {         // if found in DB
        id: number;
        canonicalName: string;
        slug: string;
        status: 'approved' | 'pending';
      };
      confidence: 'high' | 'medium' | 'low';  // AI confidence
      shouldCreate: boolean;        // true if not found in DB
    }
  ];
  metadata: {
    model: string;           // e.g., "gpt-4o-mini"
    tokensUsed: number;
    latencyMs: number;
  };
}
```

#### 4.2 Backend: AI Service

**File:** `apps/api/src/services/ai-ingredient-suggestion.ts`

**Responsibilities:**
1. Build prompt for OpenAI API
2. Call OpenAI with structured JSON output
3. Parse AI response into ingredient list
4. Match each suggestion against existing ingredients (fuzzy search)
5. Return suggestions with match status

**Prompt template:**
```
You are a culinary expert helping restaurant staff tag dish ingredients.

Given a dish name and optional description, extract ALL ingredients
that would typically be in this dish. Include:
- Main proteins, vegetables, grains
- Sauces, spices, seasonings
- Garnishes and toppings
- Common allergens (nuts, dairy, gluten-containing items)

Dish name: "{dishName}"
Description: "{description}"
Context: "{contextPrompt}"

Return a JSON array of ingredient objects with:
- name: canonical ingredient name (lowercase, singular form)
- confidence: "high" | "medium" | "low"
- category: "protein" | "vegetable" | "grain" | "sauce" | "spice" | "garnish" | "other"

Example output:
[
  { "name": "rice noodles", "confidence": "high", "category": "grain" },
  { "name": "shrimp", "confidence": "high", "category": "protein" },
  { "name": "tamarind paste", "confidence": "medium", "category": "sauce" }
]
```

**OpenAI Integration:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function suggestIngredients(params: {
  dishName: string;
  description?: string;
  contextPrompt?: string;
}) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',  // or 'gpt-4o' for better accuracy
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,  // culinary expert prompt
      },
      {
        role: 'user',
        content: buildUserPrompt(params),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,  // lower = more consistent
    max_tokens: 1000,
  });

  const suggestions = JSON.parse(response.choices[0].message.content);
  return suggestions;
}
```

#### 4.3 Backend: Ingredient Matching Logic

**File:** `apps/api/src/services/ingredient-matcher.ts`

**Responsibilities:**
1. Take AI-suggested ingredient name
2. Search existing ingredients table (approved + pending for this restaurant)
3. Use fuzzy matching with pg_trgm similarity
4. Return best match if similarity > threshold (e.g., 0.7)

**Matching strategy:**
```typescript
async function findMatchingIngredient(
  suggestedName: string,
  restaurantId: number
): Promise<IngredientMatch | null> {
  // First: exact match on canonical_name or aliases
  const exactMatch = await db.query.ingredients.findFirst({
    where: or(
      eq(ingredients.canonicalName, suggestedName.toLowerCase()),
      // Check aliases table too
    ),
  });

  if (exactMatch) return { ...exactMatch, matchType: 'exact' };

  // Second: fuzzy match using pg_trgm
  const fuzzyMatch = await db.execute(sql`
    SELECT id, canonical_name, slug, status,
           similarity(canonical_name, ${suggestedName}) as sim_score
    FROM ingredients
    WHERE status = 'approved'
      OR (status = 'pending' AND restaurant_id = ${restaurantId})
    ORDER BY sim_score DESC
    LIMIT 1
  `);

  if (fuzzyMatch[0]?.sim_score > 0.7) {
    return { ...fuzzyMatch[0], matchType: 'fuzzy' };
  }

  return null;  // No match, needs to be created
}
```

#### 4.4 Backend: Auto-Create Pending Ingredients

**File:** `apps/api/src/services/ingredient-auto-request.ts`

**Responsibilities:**
1. For unmatched AI suggestions with high confidence
2. Automatically create pending ingredient requests
3. Link to requesting restaurant
4. Return pending ingredient ID for immediate dish attachment

**Logic:**
```typescript
async function autoCreatePendingIngredient(params: {
  suggestedName: string;
  restaurantId: number;
  confidence: 'high' | 'medium' | 'low';
}): Promise<{ id: number; status: 'pending' }> {
  // Only auto-create if confidence is high or medium
  if (params.confidence === 'low') {
    return null;  // Let admin manually create if they want
  }

  const newIngredient = await db.insert(ingredients).values({
    canonicalName: params.suggestedName.toLowerCase(),
    slug: slugify(params.suggestedName),
    status: 'pending',
    restaurantId: params.restaurantId,
    description: null,  // Superadmin will fill in
    isAllergen: false,  // Conservative default
    allergenGroup: null,
    createdAt: new Date(),
  }).returning();

  return newIngredient[0];
}
```

#### 4.5 Frontend: Enhanced Dish Form UI

**File:** `apps/admin-portal/src/components/DishForm.tsx` (or similar)

**Changes:**
1. Add "Context/Notes" textarea below description
2. Add "🤖 Generate Ingredients" button
3. Add suggestion results panel with checkboxes
4. Add "Accept Selected" / "Reject All" actions
5. Keep existing manual search below

**Component structure:**
```typescript
function DishFormWithAI() {
  const [dishName, setDishName] = useState('');
  const [description, setDescription] = useState('');
  const [contextPrompt, setContextPrompt] = useState('');

  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSuggestions = async () => {
    setIsGenerating(true);
    try {
      const response = await apiClient.post('/dishes/suggest-ingredients', {
        dishName,
        description,
        contextPrompt,
      });

      setSuggestions(response.suggestions);
      // Pre-select all high-confidence approved ingredients
      const autoSelect = new Set(
        response.suggestions
          .filter(s => s.confidence === 'high' && s.matchedIngredient?.status === 'approved')
          .map((_, idx) => idx)
      );
      setSelectedSuggestions(autoSelect);
    } catch (error) {
      toast.error('Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptSelected = async () => {
    const toAccept = suggestions.filter((_, idx) => selectedSuggestions.has(idx));

    for (const suggestion of toAccept) {
      if (suggestion.matchedIngredient) {
        // Already exists, attach directly
        await addIngredientToDish(dishId, suggestion.matchedIngredient.id);
      } else if (suggestion.shouldCreate) {
        // Create pending and attach
        const pendingIngredient = await createPendingIngredient(suggestion.suggestedName);
        await addIngredientToDish(dishId, pendingIngredient.id);
      }
    }

    const pendingCount = toAccept.filter(s => !s.matchedIngredient || s.matchedIngredient.status === 'pending').length;
    if (pendingCount > 0) {
      toast.info(`${pendingCount} ingredient(s) pending superadmin approval`);
    }

    setSuggestions([]);  // Clear suggestions
  };

  return (
    <div>
      {/* Existing form fields */}
      <Input label="Dish Name *" value={dishName} onChange={setDishName} />
      <Textarea label="Description" value={description} onChange={setDescription} />

      {/* New AI context field */}
      <Textarea
        label="Additional Context (optional)"
        placeholder="e.g., Vietnamese style, extra spicy, vegetarian version"
        value={contextPrompt}
        onChange={setContextPrompt}
      />

      {/* Generate button */}
      <Button
        onClick={handleGenerateSuggestions}
        disabled={!dishName || isGenerating}
        variant="secondary"
      >
        {isGenerating ? 'Generating...' : '🤖 Generate Ingredient Suggestions'}
      </Button>

      {/* Suggestions panel */}
      {suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          selected={selectedSuggestions}
          onToggle={(idx) => {
            const newSet = new Set(selectedSuggestions);
            if (newSet.has(idx)) newSet.delete(idx);
            else newSet.add(idx);
            setSelectedSuggestions(newSet);
          }}
          onAccept={handleAcceptSelected}
          onReject={() => setSuggestions([])}
        />
      )}

      {/* Existing manual search - always available */}
      <IngredientSearchAndAttach dishId={dishId} />
    </div>
  );
}
```

#### 4.6 Environment Variables

**File:** `apps/api/.env`

```bash
# OpenAI API key
OPENAI_API_KEY=sk-...

# AI suggestion settings
AI_SUGGESTION_MODEL=gpt-4o-mini  # or gpt-4o
AI_SUGGESTION_MAX_TOKENS=1000
AI_SUGGESTION_TEMPERATURE=0.3
AI_FUZZY_MATCH_THRESHOLD=0.7  # pg_trgm similarity threshold
AI_AUTO_CREATE_CONFIDENCE=high,medium  # which confidence levels to auto-create
```

#### 4.7 New Dependencies

**`apps/api/package.json`:**
```json
{
  "dependencies": {
    "openai": "^4.73.0"
  }
}
```

**`packages/shared/src/schemas/ai-suggestions.ts`:**
```typescript
import { z } from 'zod';

export const suggestIngredientsRequestSchema = z.object({
  dishName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  contextPrompt: z.string().max(500).optional(),
  cuisineType: z.string().max(100).optional(),
});

export const ingredientSuggestionSchema = z.object({
  suggestedName: z.string(),
  matchedIngredient: z.object({
    id: z.number(),
    canonicalName: z.string(),
    slug: z.string(),
    status: z.enum(['approved', 'pending']),
  }).nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  shouldCreate: z.boolean(),
  category: z.enum(['protein', 'vegetable', 'grain', 'sauce', 'spice', 'garnish', 'other']).optional(),
});

export const suggestIngredientsResponseSchema = z.object({
  suggestions: z.array(ingredientSuggestionSchema),
  metadata: z.object({
    model: z.string(),
    tokensUsed: z.number(),
    latencyMs: z.number(),
  }),
});

export type SuggestIngredientsRequest = z.infer<typeof suggestIngredientsRequestSchema>;
export type IngredientSuggestion = z.infer<typeof ingredientSuggestionSchema>;
export type SuggestIngredientsResponse = z.infer<typeof suggestIngredientsResponseSchema>;
```

---

### Phase 2: Enhanced Matching (Optional, based on Phase 1 results)

**Scope:** Improve ingredient matching accuracy

#### 2.1 Add Ingredient Aliases to Matching

- Check `ingredient_aliases` table during matching
- Example: "cilantro" matches "coriander" via alias

#### 2.2 Synonym Expansion

- Build small synonym dictionary for common variations
- "scallion" = "green onion" = "spring onion"
- Store in config or small DB table

#### 2.3 Semantic Search with pgvector (if needed)

**Only if fuzzy matching has >20% false negatives**

- Add `pgvector` extension to PostgreSQL
- Generate embeddings for ingredient names using OpenAI `text-embedding-3-small`
- Store embeddings in new column: `ingredients.name_embedding vector(1536)`
- Match AI suggestions using cosine similarity
- Fallback to fuzzy matching if no semantic match

**Cost:** ~$0.02 per 1000 ingredients for one-time embedding generation

---

### Phase 3: Learning & Optimization (Future)

**Scope:** Make AI smarter based on usage patterns

#### 3.1 Feedback Loop

- Track which AI suggestions admins accept vs reject
- Store in new table: `ai_suggestion_feedback`
- Use to fine-tune prompts or build custom training data

#### 3.2 Restaurant-Specific Context

- Learn common ingredients per restaurant/cuisine type
- Boost suggestions based on restaurant's existing menu
- Example: Thai restaurant → boost "fish sauce", "galangal"

#### 3.3 Batch Processing

- "Generate suggestions for all dishes without ingredients"
- Background job for bulk menu imports

---

## 5. Database Schema Changes

### 5.1 New Tables (Optional for Phase 2+)

**`ai_suggestion_logs`** - Track usage and cost
```sql
CREATE TABLE ai_suggestion_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  dish_id INTEGER REFERENCES dishes(id),
  dish_name TEXT NOT NULL,
  model TEXT NOT NULL,  -- e.g., "gpt-4o-mini"
  tokens_used INTEGER,
  latency_ms INTEGER,
  suggestions_count INTEGER,
  accepted_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**`ai_suggestion_feedback`** - Track accept/reject for learning
```sql
CREATE TABLE ai_suggestion_feedback (
  id SERIAL PRIMARY KEY,
  log_id INTEGER REFERENCES ai_suggestion_logs(id),
  suggested_name TEXT NOT NULL,
  matched_ingredient_id INTEGER REFERENCES ingredients(id),
  was_accepted BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Indexes for Performance

```sql
-- Ingredient matching performance
CREATE INDEX idx_ingredients_canonical_name_trgm ON ingredients
  USING GIN (canonical_name gin_trgm_ops);

-- Optional: for semantic search (Phase 2)
-- CREATE INDEX idx_ingredients_embedding ON ingredients
--   USING ivfflat (name_embedding vector_cosine_ops);
```

---

## 6. Testing Strategy

### 6.1 Unit Tests (Vitest)

**`apps/api/src/services/__tests__/ai-ingredient-suggestion.test.ts`**
- Test prompt building logic
- Mock OpenAI API responses
- Test JSON parsing and error handling
- Test different dish types (common vs exotic)

**`apps/api/src/services/__tests__/ingredient-matcher.test.ts`**
- Test exact name matching
- Test fuzzy matching with various similarity scores
- Test alias matching
- Test case-insensitivity and trimming

### 6.2 Integration Tests

**`apps/api/src/routes/__tests__/ai-suggestions.test.ts`**
- Full E2E: request → AI call → matching → response
- Test with real OpenAI API (in CI, use test key with low rate limit)
- Test error cases: API timeout, invalid response, rate limit

### 6.3 Manual Testing Checklist

- [ ] Generate suggestions for common dishes (burger, pasta, pho)
- [ ] Generate suggestions for exotic dishes (verify quality)
- [ ] Test with minimal input (just dish name)
- [ ] Test with detailed context (verify improvement)
- [ ] Verify pending ingredient creation flow
- [ ] Verify duplicate prevention (suggesting existing ingredients)
- [ ] Test with restaurant that has pending ingredients
- [ ] Verify manual search still works after AI suggestions
- [ ] Test performance with slow API response
- [ ] Test error handling when OpenAI is down

### 6.4 Acceptance Criteria

**Functionality:**
- ✅ AI generates ≥5 relevant ingredients for common dishes
- ✅ Matching finds ≥80% of existing approved ingredients
- ✅ Auto-creates pending ingredients with correct restaurant link
- ✅ Admin can accept/reject individual suggestions
- ✅ Manual search remains fully functional

**Performance:**
- ✅ API responds in <5 seconds (p95)
- ✅ UI shows loading state during generation
- ✅ No blocking of other admin portal features

**Quality:**
- ✅ False positives (wrong ingredients) <10%
- ✅ High-confidence suggestions are accurate ≥90%
- ✅ Handles edge cases: vegan dishes, regional variants, fusion cuisine

---

## 7. Cost & Performance Estimates

### 7.1 OpenAI API Cost (GPT-4o-mini)

**Pricing:**
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Typical request:**
- Input: ~200 tokens (prompt + dish details)
- Output: ~300 tokens (10 ingredients as JSON)
- **Cost per request: ~$0.0002 (0.02 cents)**

**Monthly estimate:**
- 100 dishes/month = $0.02/month
- 1,000 dishes/month = $0.20/month
- 10,000 dishes/month = $2/month

**Conclusion: Extremely cost-effective for MVP**

### 7.2 Performance

**Expected latency:**
- OpenAI API call: 1-3 seconds (p95: 4s)
- Database matching: <100ms (with proper indexes)
- Total: 2-4 seconds end-to-end

**Optimization opportunities:**
- Cache common dishes (future)
- Use GPT-4o-mini instead of GPT-4o (3x faster)
- Parallel processing for batch suggestions

---

## 8. Security & Privacy

### 8.1 API Key Management

- Store OpenAI API key in environment variables (never in code)
- Use Fastify config service for centralized access
- Rotate keys periodically
- Monitor usage via OpenAI dashboard

### 8.2 Input Validation

- Validate all user inputs with Zod schemas
- Sanitize dish names/descriptions before sending to AI
- Rate limit API endpoint: max 20 requests/minute per user
- Prevent abuse: cap description length at 1000 chars

### 8.3 Data Privacy

- Don't send sensitive restaurant data to OpenAI
- Only send: dish name, description, generic context
- Don't send: restaurant name, pricing, proprietary recipes
- Log AI requests but don't store full API responses (GDPR)

### 8.4 Error Handling

- Graceful degradation: if OpenAI API fails, show manual search
- Don't expose OpenAI errors to frontend (generic "suggestion failed" message)
- Retry logic with exponential backoff
- Circuit breaker pattern if API is consistently down

---

## 9. Rollout Plan

### 9.1 Feature Flag (Recommended)

**Add to `apps/api/.env` and admin portal config:**
```bash
FEATURE_AI_SUGGESTIONS_ENABLED=true  # toggle on/off
AI_SUGGESTIONS_ALLOWED_RESTAURANTS=1,2,5  # whitelist for beta (optional)
```

**Benefits:**
- Test with select restaurants first
- Quick rollback if issues arise
- A/B testing opportunity

### 9.2 Phased Rollout

**Week 1-2: Internal testing**
- Enable for test restaurant only
- Gather feedback from team
- Fix critical bugs

**Week 3-4: Beta with 3-5 restaurants**
- Select diverse restaurant types (Asian, Western, fast food)
- Monitor error rates and user acceptance
- Collect qualitative feedback

**Week 5: General availability**
- Enable for all restaurants
- Announce feature via email/in-app notification
- Provide help docs / tutorial

### 9.3 Monitoring & Analytics

**Track metrics:**
- Suggestions generated per day
- Average suggestions per dish
- Acceptance rate (% of suggestions accepted)
- Ingredient creation rate (new pending ingredients)
- API errors and latency
- OpenAI costs

**Alerts:**
- API error rate >5%
- Average latency >10 seconds
- Daily cost exceeds $10 (safety threshold)

---

## 10. Open Questions & Decisions Needed

### 10.1 Product Decisions

**Q1: Should AI suggestions be automatic or opt-in?**
- **Option A:** Auto-generate when dish name is entered (proactive)
- **Option B:** Require clicking "Generate" button (user-initiated)
- **Recommendation:** Option B for MVP (gives control, no surprise API costs)

**Q2: What to do with low-confidence suggestions?**
- **Option A:** Show all suggestions, mark low-confidence with warning icon
- **Option B:** Filter out low-confidence (<threshold), only show high/medium
- **Recommendation:** Option B (reduces noise, improves trust)

**Q3: Should we allow bulk generation for existing dishes?**
- **Option A:** Add "Generate for all dishes" button in menu builder
- **Option B:** One-time migration script for existing menus (admin-run)
- **Option C:** Only for new dishes going forward
- **Recommendation:** Option C for MVP, Option B for migration if needed

### 10.2 Technical Decisions

**Q4: Fuzzy matching threshold?**
- **Options:** 0.6 (loose), 0.7 (medium), 0.8 (strict)
- **Recommendation:** Start with 0.7, tune based on false positive rate
- **Validation:** Run matching against 100 test ingredients, measure accuracy

**Q5: Auto-create pending ingredients for medium confidence?**
- **Option A:** Only high confidence
- **Option B:** High + medium
- **Option C:** Let admin decide via checkbox "Auto-create missing ingredients"
- **Recommendation:** Option B (medium confidence still valuable)

**Q6: Cache AI responses for duplicate dishes?**
- **Scenario:** Multiple restaurants add "Caesar Salad"
- **Option A:** Cache by dish name hash (7 days TTL)
- **Option B:** No caching (each request hits AI)
- **Recommendation:** Option B for MVP (simple, avoids staleness), Option A for optimization

### 10.3 UX Decisions

**Q7: Where to place "Generate" button?**
- **Option A:** Below description field (close to input)
- **Option B:** In dish form header/actions (prominent)
- **Option C:** Both (button below + action in header)
- **Recommendation:** Option A (contextual, doesn't clutter header)

**Q8: How to display pending vs approved ingredients in suggestions?**
- **Option A:** Icon + tooltip (⏳ hover for "Pending approval")
- **Option B:** Color-coded checkboxes (yellow for pending)
- **Option C:** Separate sections ("Approved" / "Pending")
- **Recommendation:** Option A (compact, clear)

**Q9: Should suggestions persist after accepting?**
- **Option A:** Clear suggestions panel after accept (clean slate)
- **Option B:** Keep rejected suggestions visible (can re-accept)
- **Recommendation:** Option A (reduces clutter), add "Regenerate" button if needed

---

## 11. Success Metrics (3 months post-launch)

**Adoption:**
- [ ] ≥40% of dishes created use AI suggestions (at least once)
- [ ] ≥60% of suggestions are accepted (at least partially)

**Efficiency:**
- [ ] Average time to add ingredients reduced by 50%
- [ ] Dishes have ≥20% more ingredients on average (better coverage)

**Quality:**
- [ ] <5% of auto-created pending ingredients rejected by superadmin
- [ ] <10% of users report "irrelevant suggestions" (survey)

**Technical:**
- [ ] API error rate <1%
- [ ] p95 latency <5 seconds
- [ ] Monthly OpenAI cost <$50 (assuming moderate usage)

---

## 12. Documentation Requirements

**For developers:**
- [ ] Update `apps/api/FEATURES.md` with new AI suggestion endpoint
- [ ] Update `IMPLEMENTED_ROUTES.md` with `POST /api/v1/dishes/suggest-ingredients`
- [ ] Add JSDoc comments to AI service functions
- [ ] Create `apps/api/docs/ai-suggestions.md` with architecture details

**For users:**
- [ ] Add help tooltip in admin portal next to "Generate" button
- [ ] Create short video tutorial (60 seconds): "How to use AI suggestions"
- [ ] Update admin portal onboarding flow to mention feature
- [ ] FAQ entry: "What does the AI ingredient suggester do?"

**For superadmins:**
- [ ] Document how to review auto-created pending ingredients
- [ ] Explain that AI-created ingredients may have minimal descriptions
- [ ] Provide best practices for approving bulk suggestions

---

## 13. Future Enhancements (Post-MVP)

**Phase 4: Multilingual Support**
- Detect dish language (e.g., "Phở Bò" → Vietnamese)
- Generate suggestions in native language
- Match against localized ingredient names/translations

**Phase 5: Image-Based Suggestions**
- Admin uploads dish photo
- AI analyzes image + name for better accuracy
- Use GPT-4 Vision or similar

**Phase 6: Nutritional Data Integration**
- AI suggests ingredients with nutritional info
- Auto-populate allergen flags
- Integrate with USDA FoodData (already have CSVs)

**Phase 7: Recipe Assistance**
- Expand from ingredients to preparation steps
- "How is this dish typically made?" → AI-generated recipe
- Optional field for admin to review/edit

**Phase 8: Menu Analysis**
- "Analyze my menu for common allergens"
- "Suggest popular dishes missing from my menu"
- AI-powered menu optimization

---

## 14. Appendix: Alternative Approaches Considered

### A. Rule-Based Ingredient Extraction (Not recommended)
**Approach:** Use NLP libraries (SpaCy, NLTK) to parse dish names
**Pros:** No API costs, fully offline
**Cons:** Low accuracy, requires extensive manual rules, hard to maintain
**Verdict:** LLMs are far superior for this task

### B. Crowdsourced Ingredient Database (Not recommended for MVP)
**Approach:** Build community-submitted dish→ingredient mappings
**Pros:** High accuracy for common dishes
**Cons:** Requires critical mass of users, doesn't scale to custom dishes
**Verdict:** Good supplement but not replacement for AI

### C. Semantic Search Only (No generative AI)
**Approach:** Embed dish descriptions, find similar dishes in DB, copy ingredients
**Pros:** Fast, deterministic
**Cons:** Requires large existing dish database, doesn't help with new/unique dishes
**Verdict:** Useful optimization but not core solution

---

## 15. Conclusion & Recommendation

**Recommended approach:**
1. **Start with Phase 1** (Core AI Integration using OpenAI GPT-4o-mini)
2. **Use PostgreSQL + pg_trgm** for ingredient matching (no vector DB needed for MVP)
3. **User-initiated suggestions** (button click, not automatic)
4. **Auto-create pending ingredients** for high + medium confidence
5. **Feature flag** for controlled rollout
6. **Monitor closely** for first month, iterate based on feedback

**Why this approach:**
- ✅ Leverages existing PostgreSQL infrastructure
- ✅ Minimal new dependencies (just OpenAI SDK)
- ✅ Cost-effective (~$0.0002 per suggestion)
- ✅ Fast to implement (1-2 week sprint)
- ✅ Graceful degradation (manual search always available)
- ✅ Fits existing approval workflow seamlessly

**Risks & mitigations:**
- **Risk:** AI suggests irrelevant ingredients
  **Mitigation:** Allow per-suggestion rejection, don't auto-accept, collect feedback

- **Risk:** OpenAI API downtime
  **Mitigation:** Fallback to manual search, show friendly error, implement retry logic

- **Risk:** Unexpected costs from abuse
  **Mitigation:** Rate limiting, feature flag, monitoring alerts

**Next steps:**
1. Get stakeholder approval on this plan
2. Set up OpenAI API account and get key
3. Create implementation tasks in project tracker
4. Start with backend AI service (can test independently)
5. Build frontend UI once backend is working
6. Internal testing with sample dishes
7. Beta rollout with 3-5 restaurants

---

**Questions? Contact the implementation team or refer to this plan document.**
