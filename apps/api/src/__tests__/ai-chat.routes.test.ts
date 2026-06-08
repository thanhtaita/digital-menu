import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { aiChatRoutes } from "../routes/ai-chat.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../services/ai-chat.js", () => ({
  processChat: vi.fn(),
  getChatHistory: vi.fn(),
  clearChatSession: vi.fn(),
}));

import { requireAuth } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { processChat, getChatHistory, clearChatSession } from "../services/ai-chat.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = { userId: 1, email: "diner@test.com", role: "diner" };
const MOCK_RESTAURANT = { id: 42 };
const KNOWN_SLUG = "pasta-palace";

function authAs(user: typeof MOCK_USER | null) {
  if (user === null) {
    vi.mocked(requireAuth).mockImplementation(async (_req, reply) => {
      reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return undefined;
    });
  } else {
    vi.mocked(requireAuth).mockResolvedValue({ user });
  }
}

function dbReturnsRestaurant(restaurant: typeof MOCK_RESTAURANT | null) {
  const rows = restaurant ? [restaurant] : [];
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(res, rej),
    configurable: true,
  });
  vi.mocked(db.select).mockReturnValue(chain as ReturnType<typeof db.select>);
}

// ─── App setup ────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify({ logger: false });
  await app.register(aiChatRoutes, { prefix: "/public" });
});

afterAll(async () => {
  await app.close();
});

// ─── POST /public/restaurants/:slug/chat ─────────────────────────────────────

describe("POST /public/restaurants/:slug/chat", () => {
  it("returns 401 when not authenticated", async () => {
    authAs(null);
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "What should I order?" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when restaurant slug is not found", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(null);
    const res = await app.inject({
      method: "POST",
      url: "/public/restaurants/unknown-slug/chat",
      payload: { message: "Hello" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("Restaurant not found");
  });

  it("returns 422 when message is empty", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when message exceeds 1000 characters", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "x".repeat(1001) },
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when message field is missing", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it("returns 503 when AI is not configured", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    const { AiNotConfiguredError } = await import("../lib/ai/types.js");
    vi.mocked(processChat).mockRejectedValue(new AiNotConfiguredError());
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "Any recommendations?" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("AI_NOT_CONFIGURED");
  });

  it("returns 502 on general AI error", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(processChat).mockRejectedValue(new Error("Network timeout"));
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "Any recommendations?" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("AI_ERROR");
  });

  it("returns 200 with message and recommendations on success", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(processChat).mockResolvedValue({
      message: "You'd love the Carbonara!",
      recommendations: [{ dishName: "Carbonara", reason: "Rich and creamy" }],
      sessionId: 7,
    });
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "What pasta do you recommend?" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.message).toBe("You'd love the Carbonara!");
    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0].dishName).toBe("Carbonara");
    expect(body.sessionId).toBe(7);
  });

  it("returns 200 with empty recommendations array when AI returns none", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(processChat).mockResolvedValue({
      message: "Happy to help! What are you in the mood for?",
      recommendations: [],
      sessionId: 3,
    });
    const res = await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "Hi" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().recommendations).toEqual([]);
  });

  it("calls processChat with correct userId, restaurantId, and message", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(processChat).mockResolvedValue({ message: "Sure!", recommendations: [], sessionId: 1 });
    await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "Something spicy please" },
    });
    expect(processChat).toHaveBeenCalledWith({
      userId: MOCK_USER.userId,
      restaurantId: MOCK_RESTAURANT.id,
      message: "Something spicy please",
    });
  });

  it("trims leading/trailing whitespace from message", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(processChat).mockResolvedValue({ message: "Ok", recommendations: [], sessionId: 1 });
    await app.inject({
      method: "POST",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
      payload: { message: "  What is good?  " },
    });
    expect(vi.mocked(processChat).mock.calls[0][0].message).toBe("What is good?");
  });
});

// ─── GET /public/restaurants/:slug/chat/history ───────────────────────────────

describe("GET /public/restaurants/:slug/chat/history", () => {
  it("returns 401 when not authenticated", async () => {
    authAs(null);
    const res = await app.inject({
      method: "GET",
      url: `/public/restaurants/${KNOWN_SLUG}/chat/history`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when restaurant is not found", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(null);
    const res = await app.inject({
      method: "GET",
      url: "/public/restaurants/ghost-cafe/chat/history",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 200 with empty history on first visit", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(getChatHistory).mockResolvedValue({
      restaurantName: "Pasta Palace",
      messages: [],
      summary: null,
    });
    const res = await app.inject({
      method: "GET",
      url: `/public/restaurants/${KNOWN_SLUG}/chat/history`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.restaurantName).toBe("Pasta Palace");
    expect(body.messages).toHaveLength(0);
    expect(body.summary).toBeNull();
  });

  it("returns 200 with messages and conversation summary", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(getChatHistory).mockResolvedValue({
      restaurantName: "Pasta Palace",
      messages: [
        { id: 1, role: "user", content: "What's popular?", createdAt: "2026-06-07T10:00:00.000Z" },
        { id: 2, role: "assistant", content: "The Carbonara is a crowd favourite.", createdAt: "2026-06-07T10:00:01.000Z" },
      ],
      summary: "User is interested in popular dishes.",
    });
    const res = await app.inject({
      method: "GET",
      url: `/public/restaurants/${KNOWN_SLUG}/chat/history`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[1].role).toBe("assistant");
    expect(body.summary).toBe("User is interested in popular dishes.");
  });

  it("calls getChatHistory with correct userId and restaurantId", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(getChatHistory).mockResolvedValue({ restaurantName: "X", messages: [], summary: null });
    await app.inject({ method: "GET", url: `/public/restaurants/${KNOWN_SLUG}/chat/history` });
    expect(getChatHistory).toHaveBeenCalledWith({ userId: MOCK_USER.userId, restaurantId: MOCK_RESTAURANT.id });
  });
});

// ─── DELETE /public/restaurants/:slug/chat ────────────────────────────────────

describe("DELETE /public/restaurants/:slug/chat", () => {
  it("returns 401 when not authenticated", async () => {
    authAs(null);
    const res = await app.inject({
      method: "DELETE",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when restaurant is not found", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(null);
    const res = await app.inject({
      method: "DELETE",
      url: "/public/restaurants/no-such-place/chat",
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 204 on successful session clear", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(clearChatSession).mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/public/restaurants/${KNOWN_SLUG}/chat`,
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
  });

  it("calls clearChatSession with correct userId and restaurantId", async () => {
    authAs(MOCK_USER);
    dbReturnsRestaurant(MOCK_RESTAURANT);
    vi.mocked(clearChatSession).mockResolvedValue(undefined);
    await app.inject({ method: "DELETE", url: `/public/restaurants/${KNOWN_SLUG}/chat` });
    expect(clearChatSession).toHaveBeenCalledWith({ userId: MOCK_USER.userId, restaurantId: MOCK_RESTAURANT.id });
  });
});
