import { describe, it, expect } from "vitest";
import { getDishStatus, getMatchingRestrictions } from "@/lib/restriction-engine";
import type { PublicDishIngredient, RestrictionResponse } from "@digital-menu/shared";

function ingredient(overrides: Partial<PublicDishIngredient> = {}): PublicDishIngredient {
  return {
    id: 1,
    ingredientId: 1,
    canonicalName: "chicken broth",
    slug: "chicken-broth",
    description: null,
    imageUrl: null,
    media: [],
    nutrients: null,
    isCommonAllergen: false,
    commonAllergenGroup: null,
    dietTags: null,
    isOptional: false,
    ...overrides
  };
}

function dietRestriction(overrides: Partial<RestrictionResponse> = {}): RestrictionResponse {
  return {
    id: 1,
    userId: 1,
    restrictionType: "diet",
    ingredientId: null,
    dietType: "vegan",
    severity: "block",
    ingredient: null,
    ...overrides
  };
}

function allergyRestriction(overrides: Partial<RestrictionResponse> = {}): RestrictionResponse {
  return {
    id: 2,
    userId: 1,
    restrictionType: "allergy",
    ingredientId: 1,
    dietType: null,
    severity: "block",
    ingredient: { id: 1, canonicalName: "peanut", slug: "peanut" },
    ...overrides
  };
}

describe("getDishStatus - diet restrictions", () => {
  it("blocks a dish when an ingredient is explicitly tagged incompatible with the diet", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: false } })];
    const status = getDishStatus([dietRestriction({ dietType: "vegan", severity: "block" })], dish);
    expect(status).toBe("blocked");
  });

  it("warns instead of blocking when the restriction severity is warn", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: false } })];
    const status = getDishStatus([dietRestriction({ dietType: "vegan", severity: "warn" })], dish);
    expect(status).toBe("warn");
  });

  it("treats an untagged ingredient (no diet_tags at all) as no signal, not a violation", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: null })];
    const status = getDishStatus([dietRestriction({ dietType: "vegan" })], dish);
    expect(status).toBe("safe");
  });

  it("treats a missing key for this diet type as no signal, not a violation", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { halal: true } })];
    const status = getDishStatus([dietRestriction({ dietType: "vegan" })], dish);
    expect(status).toBe("safe");
  });

  it("is safe when the ingredient is explicitly tagged compatible", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: true } })];
    const status = getDishStatus([dietRestriction({ dietType: "vegan" })], dish);
    expect(status).toBe("safe");
  });

  it("blocks if any one of several dish ingredients violates the diet", () => {
    const dish = [
      ingredient({ ingredientId: 1, dietTags: { vegan: true } }),
      ingredient({ ingredientId: 2, dietTags: { vegan: false } })
    ];
    const status = getDishStatus([dietRestriction({ dietType: "vegan" })], dish);
    expect(status).toBe("blocked");
  });

  it("still evaluates allergy/dislike restrictions alongside diet restrictions", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: true } })];
    const status = getDishStatus(
      [dietRestriction({ dietType: "vegan" }), allergyRestriction({ ingredientId: 1, severity: "block" })],
      dish
    );
    expect(status).toBe("blocked");
  });
});

describe("getMatchingRestrictions - diet restrictions", () => {
  it("includes a diet restriction that the dish violates", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: false } })];
    const restriction = dietRestriction({ dietType: "vegan" });
    expect(getMatchingRestrictions([restriction], dish)).toEqual([restriction]);
  });

  it("excludes a diet restriction the dish does not violate", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: true } })];
    const restriction = dietRestriction({ dietType: "vegan" });
    expect(getMatchingRestrictions([restriction], dish)).toEqual([]);
  });

  it("excludes a diet restriction with no dietType set", () => {
    const dish = [ingredient({ ingredientId: 1, dietTags: { vegan: false } })];
    const restriction = dietRestriction({ dietType: undefined });
    expect(getMatchingRestrictions([restriction], dish)).toEqual([]);
  });
});
