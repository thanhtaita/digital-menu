import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetaIngredientsPage } from "./meta-ingredients";
import {
  apiAcceptDietCandidate,
  apiAcceptFdcCandidate,
  apiListDietCandidates,
  apiListFdcCandidates,
  apiListIngredients,
  apiListPendingIngredients,
  apiRejectDietCandidate,
  apiRejectFdcCandidate,
  apiSearchIngredients
} from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiListPendingIngredients: vi.fn(),
  apiApproveIngredient: vi.fn(),
  apiRejectIngredient: vi.fn(),
  apiListFdcCandidates: vi.fn(),
  apiAcceptFdcCandidate: vi.fn(),
  apiRejectFdcCandidate: vi.fn(),
  apiListDietCandidates: vi.fn(),
  apiAcceptDietCandidate: vi.fn(),
  apiRejectDietCandidate: vi.fn(),
  apiListIngredients: vi.fn(),
  apiSearchIngredients: vi.fn(),
  apiCreateIngredient: vi.fn(),
  apiUpdateIngredient: vi.fn(),
  apiDeleteIngredient: vi.fn(),
  apiUploadIngredientMedia: vi.fn(),
  apiDeleteIngredientMedia: vi.fn(),
  apiReorderIngredientMedia: vi.fn(),
  apiListIngredientTranslations: vi.fn(),
  apiUpsertIngredientTranslation: vi.fn(),
  apiDeleteIngredientTranslation: vi.fn()
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MetaIngredientsPage />
    </QueryClientProvider>
  );
}

describe("MetaIngredientsPage - FDC nutrition matches", () => {
  it("renders the pending review queue and accepts a match", async () => {
    const user = userEvent.setup();
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListDietCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 10,
        ingredientId: 3,
        ingredientCanonicalName: "Sumac",
        fdcId: 174962,
        fdcDescription: "Spices, sumac",
        score: 0.45,
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    (apiAcceptFdcCandidate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 3,
      canonicalName: "Sumac",
      slug: "sumac",
      isCommonAllergen: false,
      approvalStatus: "approved",
      requestedByRestaurantId: null,
      fdcId: 174962,
      nutrients: { cal: 300 },
      media: []
    });

    renderPage();

    await screen.findByText("Sumac", {}, { timeout: 3000 });
    expect(screen.getByText(/Spices, sumac/)).toBeInTheDocument();

    const row = screen.getByText("Sumac").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(apiAcceptFdcCandidate).toHaveBeenCalledWith(10));
  });

  it("shows a confirmation before rejecting a match", async () => {
    const user = userEvent.setup();
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListDietCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 10,
        ingredientId: 3,
        ingredientCanonicalName: "Sumac",
        fdcId: 174962,
        fdcDescription: "Spices, sumac",
        score: 0.45,
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);

    renderPage();

    await screen.findByText("Sumac", {}, { timeout: 3000 });
    const row = screen.getByText("Sumac").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Reject" }));

    const dialog = await screen.findByText("Reject FDC match");
    await user.click(within(dialog.closest("div.relative")!).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(apiRejectFdcCandidate).toHaveBeenCalledWith(10));
  });

  it("shows an empty state when there are no candidates", async () => {
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListDietCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiSearchIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderPage();

    await screen.findByText("No pending FDC matches to review.");
  });
});

describe("MetaIngredientsPage - diet tag matches", () => {
  it("renders the pending diet-tag queue and accepts a tag", async () => {
    const user = userEvent.setup();
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListDietCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 20,
        ingredientId: 5,
        ingredientCanonicalName: "Chicken broth",
        dietType: "vegan",
        compatible: false,
        confidence: "medium",
        reasoning: "Animal-derived stock.",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    (apiAcceptDietCandidate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 5,
      canonicalName: "Chicken broth",
      slug: "chicken-broth",
      isCommonAllergen: false,
      approvalStatus: "approved",
      requestedByRestaurantId: null,
      dietTags: { vegan: false },
      media: []
    });

    renderPage();

    await screen.findByText("Chicken broth", {}, { timeout: 3000 });
    expect(screen.getByText("incompatible")).toBeInTheDocument();

    const row = screen.getByText("Chicken broth").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(apiAcceptDietCandidate).toHaveBeenCalledWith(20));
  });

  it("shows a confirmation before rejecting a diet tag", async () => {
    const user = userEvent.setup();
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListDietCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 20,
        ingredientId: 5,
        ingredientCanonicalName: "Chicken broth",
        dietType: "vegan",
        compatible: false,
        confidence: "medium",
        reasoning: "Animal-derived stock.",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);

    renderPage();

    await screen.findByText("Chicken broth", {}, { timeout: 3000 });
    const row = screen.getByText("Chicken broth").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Reject" }));

    const dialog = await screen.findByText("Reject diet tag");
    await user.click(within(dialog.closest("div.relative")!).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(apiRejectDietCandidate).toHaveBeenCalledWith(20));
  });

  it("shows an empty state when there are no diet-tag candidates", async () => {
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListDietCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiSearchIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderPage();

    await screen.findByText("No pending diet tags to review.");
  });
});
