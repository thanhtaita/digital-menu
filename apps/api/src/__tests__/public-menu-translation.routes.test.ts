import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { publicMenuRoutes } from "../routes/public-menu.js";

vi.mock("../lib/db.js", () => ({
  db: {
    select: vi.fn()
  }
}));

vi.mock("../services/ai-translation.js", () => ({
  resolveEntityTranslations: vi.fn(),
  isSupportedTranslationLocale: vi.fn()
}));

vi.mock("../services/search.js", () => ({
  searchCatalog: vi.fn()
}));

import { db } from "../lib/db.js";
import { resolveEntityTranslations, isSupportedTranslationLocale } from "../services/ai-translation.js";

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

const RESTAURANT = { id: 1, name: "Cafe Test", slug: "cafe-test", description: null, logoUrl: null };
const MENU = { id: 10, restaurantId: 1, name: "Dinner", isPublished: true, displayOrder: 0 };
const SECTION = { id: 20, menuId: 10, name: "Mains", displayOrder: 0 };
const DISH = {
  id: 30,
  sectionId: 20,
  name: "Grilled Salmon",
  description: "Served with lemon butter.",
  price: "18.00",
  imageUrl: null,
  isAvailable: true,
  displayOrder: 0
};
const DISH_INGREDIENT_ROW = {
  linkId: 40,
  dishId: 30,
  ingredientId: 50,
  isOptional: false,
  canonicalName: "Salmon",
  slug: "salmon",
  description: "Farmed Atlantic salmon.",
  imageUrl: null,
  nutrients: null,
  isCommonAllergen: false,
  commonAllergenGroup: null,
  dietTags: null
};

/** The seven base db.select() calls the route always makes before any locale resolution. */
function baseSelectQueue() {
  return [[RESTAURANT], [MENU], [SECTION], [DISH], [], [DISH_INGREDIENT_ROW], []];
}

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify({ logger: false });
  await app.register(publicMenuRoutes);
});

afterAll(async () => {
  await app.close();
});

describe("GET /restaurants/:slug/menu?locale=", () => {
  it("serves source text and never calls the translation service for an unsupported locale", async () => {
    vi.mocked(isSupportedTranslationLocale).mockReturnValue(false);
    mockSelectQueue(baseSelectQueue());

    const res = await app.inject({ method: "GET", url: "/restaurants/cafe-test/menu?locale=xx" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const dish = body.menus[0].sections[0].dishes[0];
    expect(dish.name).toBe("Grilled Salmon");
    expect(dish.description).toBe("Served with lemon butter.");
    expect(dish.ingredients[0].canonicalName).toBe("Salmon");
    expect(resolveEntityTranslations).not.toHaveBeenCalled();
  });

  it("serves source text when no locale is requested at all", async () => {
    vi.mocked(isSupportedTranslationLocale).mockReturnValue(false);
    mockSelectQueue(baseSelectQueue());

    const res = await app.inject({ method: "GET", url: "/restaurants/cafe-test/menu" });

    expect(res.statusCode).toBe(200);
    expect(resolveEntityTranslations).not.toHaveBeenCalled();
  });

  it("resolves and substitutes translated fields for a supported locale", async () => {
    vi.mocked(isSupportedTranslationLocale).mockReturnValue(true);
    // 7 base queries + manual dish translations + manual ingredient translations = 9
    mockSelectQueue([...baseSelectQueue(), [], []]);

    vi.mocked(resolveEntityTranslations).mockImplementation(async ({ entityType, fields }) => {
      const result: Record<string, { value: string; provenance: string }> = {};
      for (const f of fields) {
        result[f.field] = { value: `[${entityType}:fr] ${f.text ?? ""}`, provenance: "ai" };
      }
      return result;
    });

    const res = await app.inject({ method: "GET", url: "/restaurants/cafe-test/menu?locale=fr" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const dish = body.menus[0].sections[0].dishes[0];
    expect(dish.name).toBe("[dish:fr] Grilled Salmon");
    expect(dish.description).toBe("[dish:fr] Served with lemon butter.");
    const ingredient = dish.ingredients[0];
    expect(ingredient.canonicalName).toBe("[ingredient:fr] Salmon");
    expect(ingredient.description).toBe("[ingredient:fr] Farmed Atlantic salmon.");
    // commonAllergenGroup source was null - never sent to the translator, stays null.
    expect(ingredient.commonAllergenGroup).toBeNull();
  });

  it("returns 404 for an inactive/missing restaurant without ever touching translation", async () => {
    mockSelectQueue([[]]);
    const res = await app.inject({ method: "GET", url: "/restaurants/does-not-exist/menu?locale=fr" });
    expect(res.statusCode).toBe(404);
    expect(resolveEntityTranslations).not.toHaveBeenCalled();
  });
});
