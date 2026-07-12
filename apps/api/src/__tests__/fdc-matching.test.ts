import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/db.js", () => ({
  db: {
    execute: vi.fn(),
    update: vi.fn(),
    select: vi.fn()
  }
}));

import { db } from "../lib/db.js";
import {
  findFdcCandidates,
  fetchFdcNutrients,
  fetchFdcFoodCategory,
  applyFdcMatch,
  CANDIDATE_THRESHOLD,
  AUTO_ACCEPT_THRESHOLD
} from "../services/fdc-matching.js";

function updateChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["set", "where"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("thresholds", () => {
  it("candidate threshold is below the auto-accept threshold", () => {
    expect(CANDIDATE_THRESHOLD).toBeLessThan(AUTO_ACCEPT_THRESHOLD);
  });
});

describe("findFdcCandidates", () => {
  it("maps db rows to candidates ordered by score", async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        { fdc_id: 747997, description: "Egg, whole, raw", score: 0.82 },
        { fdc_id: 323294, description: "Egg, white, raw", score: 0.61 }
      ]
    } as never);

    const result = await findFdcCandidates("egg");
    expect(result).toEqual([
      { fdcId: 747997, description: "Egg, whole, raw", score: 0.82 },
      { fdcId: 323294, description: "Egg, white, raw", score: 0.61 }
    ]);
  });

  it("returns [] without querying when the name is blank", async () => {
    const result = await findFdcCandidates("   ");
    expect(result).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("returns [] instead of throwing when fdc schema/pg_trgm is unavailable", async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('schema "fdc" does not exist'));
    const result = await findFdcCandidates("egg");
    expect(result).toEqual([]);
  });
});

describe("fetchFdcNutrients", () => {
  it("maps known nutrient_ids to named keys and rounds to 1 decimal", async () => {
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        { nutrient_id: 1008, amount: "143.333" },
        { nutrient_id: 1003, amount: "12.56" },
        { nutrient_id: 9999, amount: "1.0" } // not in the fixed set - ignored
      ]
    } as never);

    const nutrients = await fetchFdcNutrients(747997);
    expect(nutrients).toEqual({ cal: 143.3, protein: 12.6 });
  });

  it("returns an empty object when no nutrient rows match", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
    const nutrients = await fetchFdcNutrients(1);
    expect(nutrients).toEqual({});
  });
});

describe("fetchFdcFoodCategory", () => {
  it("returns the category description when present", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [{ description: "Dairy and Egg Products" }] } as never);
    expect(await fetchFdcFoodCategory(747997)).toBe("Dairy and Egg Products");
  });

  it("returns null when the food has no category", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
    expect(await fetchFdcFoodCategory(1)).toBeNull();
  });
});

describe("applyFdcMatch", () => {
  it("sets ingredient fdc_id/nutrients/food_category, accepts the matched candidate, and rejects other pending ones", async () => {
    vi.mocked(db.execute)
      .mockResolvedValueOnce({ rows: [{ nutrient_id: 1008, amount: "150" }] } as never) // nutrients
      .mockResolvedValueOnce({ rows: [{ description: "Dairy and Egg Products" }] } as never); // category

    const updateChains = [updateChain(), updateChain(), updateChain()];
    let call = 0;
    vi.mocked(db.update).mockImplementation(() => updateChains[call++] as never);

    await applyFdcMatch({ ingredientId: 5, fdcId: 747997 });

    expect(db.update).toHaveBeenCalledTimes(3);
    expect(updateChains[0]!.set).toHaveBeenCalledWith({
      fdcId: 747997,
      foodCategory: "Dairy and Egg Products",
      nutrients: { cal: 150 }
    });
    expect(updateChains[1]!.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "accepted" })
    );
    expect(updateChains[2]!.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" })
    );
  });
});
