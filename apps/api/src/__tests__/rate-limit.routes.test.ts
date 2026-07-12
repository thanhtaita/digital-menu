import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { rateLimitKeyGenerator, LLM_RATE_LIMIT, SEARCH_RATE_LIMIT } from "../lib/rate-limit.js";
import { aiChatRoutes } from "../routes/ai-chat.js";
import { aiSuggestionRoutes } from "../routes/ai-suggestions.js";
import { ingredientRoutes } from "../routes/ingredients.js";

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn()
}));

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn()
  }
}));

vi.mock("../services/ai-chat.js", () => ({
  processChat: vi.fn(),
  processChatStream: vi.fn(),
  getChatHistory: vi.fn(),
  clearChatSession: vi.fn(),
  likeDishInSession: vi.fn()
}));

vi.mock("../services/ai-ingredient-suggestion.js", () => ({
  suggestIngredients: vi.fn()
}));

vi.mock("../lib/restaurant-access.js", () => ({
  canUserManageRestaurantWithRole: vi.fn(),
  canUserManageRestaurant: vi.fn(),
  getRestaurantIdsManagedByUser: vi.fn()
}));

import { requireAuth } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { processChat } from "../services/ai-chat.js";
import { suggestIngredients } from "../services/ai-ingredient-suggestion.js";
import { canUserManageRestaurantWithRole, getRestaurantIdsManagedByUser } from "../lib/restaurant-access.js";

const MOCK_USER = { userId: 1, email: "diner@test.com", role: "diner" };

function authAs(user: typeof MOCK_USER) {
  vi.mocked(requireAuth).mockResolvedValue({ user } as never);
}

/** Chainable thenable mimicking a Drizzle query builder; resolves to `rows`. */
function queryChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy", "limit", "offset", "and"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(res, rej),
    configurable: true
  });
  return chain;
}

async function buildTestApp(register: (app: FastifyInstance) => unknown): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(rateLimit, { global: false, keyGenerator: rateLimitKeyGenerator });
  await register(app);
  return app;
}

let app: FastifyInstance;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await app?.close();
});

describe("POST /restaurants/:slug/chat rate limiting", () => {
  beforeEach(async () => {
    app = await buildTestApp((a) => a.register(aiChatRoutes, { prefix: "/public" }));
    authAs(MOCK_USER);
    vi.mocked(db.select).mockReturnValue(queryChain([{ id: 42 }]) as never);
    vi.mocked(processChat).mockResolvedValue({ message: "Sure!", recommendations: [], sessionId: 1 });
  });

  it("allows requests up to the limit and then returns 429", async () => {
    for (let i = 0; i < LLM_RATE_LIMIT.max; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/public/restaurants/pasta-palace/chat",
        payload: { message: "hi" }
      });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/public/restaurants/pasta-palace/chat",
      payload: { message: "hi" }
    });
    expect(blocked.statusCode).toBe(429);
  });

  it("tracks separate buckets per session cookie", async () => {
    for (let i = 0; i < LLM_RATE_LIMIT.max; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/public/restaurants/pasta-palace/chat",
        headers: { cookie: "session_id=user-a" },
        payload: { message: "hi" }
      });
      expect(res.statusCode).toBe(200);
    }
    const blockedA = await app.inject({
      method: "POST",
      url: "/public/restaurants/pasta-palace/chat",
      headers: { cookie: "session_id=user-a" },
      payload: { message: "hi" }
    });
    expect(blockedA.statusCode).toBe(429);

    // A different session cookie gets its own bucket and is not affected by user-a's usage.
    const otherUser = await app.inject({
      method: "POST",
      url: "/public/restaurants/pasta-palace/chat",
      headers: { cookie: "session_id=user-b" },
      payload: { message: "hi" }
    });
    expect(otherUser.statusCode).toBe(200);
  });
});

describe("POST /dishes/suggest-ingredients rate limiting", () => {
  beforeEach(async () => {
    app = await buildTestApp((a) => a.register(aiSuggestionRoutes));
    authAs({ ...MOCK_USER, role: "restaurant_admin" });
    vi.mocked(canUserManageRestaurantWithRole).mockResolvedValue(true);
    vi.mocked(suggestIngredients).mockResolvedValue({ suggestions: [] } as never);
  });

  it("returns 429 once the per-minute limit is exceeded", async () => {
    for (let i = 0; i < LLM_RATE_LIMIT.max; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/dishes/suggest-ingredients",
        payload: { dishName: "Carbonara", restaurantId: 1 }
      });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/dishes/suggest-ingredients",
      payload: { dishName: "Carbonara", restaurantId: 1 }
    });
    expect(blocked.statusCode).toBe(429);
  });
});

describe("GET /ingredients search rate limiting", () => {
  beforeEach(async () => {
    app = await buildTestApp((a) => a.register(ingredientRoutes, { prefix: "/ingredients" }));
    vi.mocked(db.select).mockReturnValue(queryChain([]) as never);
    vi.mocked(getRestaurantIdsManagedByUser).mockResolvedValue([]);
  });

  it("returns 429 once the per-minute search limit is exceeded", async () => {
    for (let i = 0; i < SEARCH_RATE_LIMIT.max; i++) {
      const res = await app.inject({ method: "GET", url: "/ingredients?q=tomato" });
      expect(res.statusCode).toBe(200);
    }

    const blocked = await app.inject({ method: "GET", url: "/ingredients?q=tomato" });
    expect(blocked.statusCode).toBe(429);
  });
});
