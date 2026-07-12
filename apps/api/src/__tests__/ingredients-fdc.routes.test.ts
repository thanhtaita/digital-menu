import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { ingredientRoutes } from "../routes/ingredients.js";

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn()
}));

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

vi.mock("../services/fdc-matching.js", () => ({
  applyFdcMatch: vi.fn()
}));

import { requireAuth } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { applyFdcMatch } from "../services/fdc-matching.js";

const SUPERADMIN = { userId: 1, email: "root@test.com", role: "superadmin" };
const DINER = { userId: 2, email: "diner@test.com", role: "diner" };

function authAs(user: typeof SUPERADMIN | typeof DINER | null) {
  if (user === null) {
    vi.mocked(requireAuth).mockImplementation(async (_req, reply) => {
      reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return undefined;
    });
  } else {
    vi.mocked(requireAuth).mockResolvedValue({ user } as never);
  }
}

/** Chainable thenable mimicking a Drizzle query builder; resolves to `rows`. */
function queryChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "where", "orderBy", "limit"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(res, rej),
    configurable: true
  });
  return chain;
}

/** Queues up successive db.select() calls, one result set per call, in order. */
function mockSelectQueue(resultSets: unknown[][]) {
  let call = 0;
  vi.mocked(db.select).mockImplementation(() => {
    const rows = resultSets[call] ?? [];
    call += 1;
    return queryChain(rows) as never;
  });
}

function updateChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["set", "where"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify({ logger: false });
  await app.register(ingredientRoutes, { prefix: "/ingredients" });
});

afterAll(async () => {
  await app.close();
});

describe("GET /ingredients/fdc-candidates", () => {
  it("returns 403 for non-superadmins", async () => {
    authAs(DINER);
    const res = await app.inject({ method: "GET", url: "/ingredients/fdc-candidates" });
    expect(res.statusCode).toBe(403);
  });

  it("returns the pending review queue with numeric scores and ISO timestamps", async () => {
    authAs(SUPERADMIN);
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    mockSelectQueue([
      [
        {
          id: 10,
          ingredientId: 3,
          ingredientCanonicalName: "Sumac",
          fdcId: 174962,
          fdcDescription: "Spices, sumac",
          score: "0.4500",
          status: "pending",
          createdAt
        }
      ]
    ]);

    const res = await app.inject({ method: "GET", url: "/ingredients/fdc-candidates" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual([
      {
        id: 10,
        ingredientId: 3,
        ingredientCanonicalName: "Sumac",
        fdcId: 174962,
        fdcDescription: "Spices, sumac",
        score: 0.45,
        status: "pending",
        createdAt: createdAt.toISOString()
      }
    ]);
  });
});

describe("POST /ingredients/fdc-candidates/:id/accept", () => {
  it("returns 404 when the candidate is not pending", async () => {
    authAs(SUPERADMIN);
    mockSelectQueue([[]]);
    const res = await app.inject({ method: "POST", url: "/ingredients/fdc-candidates/999/accept" });
    expect(res.statusCode).toBe(404);
    expect(applyFdcMatch).not.toHaveBeenCalled();
  });

  it("applies the match and returns the updated ingredient", async () => {
    authAs(SUPERADMIN);
    mockSelectQueue([
      [{ id: 10, ingredientId: 3, fdcId: 174962, fdcDescription: "Spices, sumac", status: "pending" }],
      [{ id: 3, canonicalName: "Sumac", nutrients: { cal: 300 }, fdcId: 174962 }],
      []
    ]);

    const res = await app.inject({ method: "POST", url: "/ingredients/fdc-candidates/10/accept" });
    expect(res.statusCode).toBe(200);
    expect(applyFdcMatch).toHaveBeenCalledWith({ ingredientId: 3, fdcId: 174962 });
    expect(res.json().canonicalName).toBe("Sumac");
  });
});

describe("POST /ingredients/fdc-candidates/:id/reject", () => {
  it("returns 404 when the candidate is not pending", async () => {
    authAs(SUPERADMIN);
    mockSelectQueue([[]]);
    const res = await app.inject({ method: "POST", url: "/ingredients/fdc-candidates/999/reject" });
    expect(res.statusCode).toBe(404);
  });

  it("marks a pending candidate rejected", async () => {
    authAs(SUPERADMIN);
    mockSelectQueue([[{ id: 10, status: "pending" }]]);
    const chain = updateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    const res = await app.inject({ method: "POST", url: "/ingredients/fdc-candidates/10/reject" });
    expect(res.statusCode).toBe(204);
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected" }));
  });
});
