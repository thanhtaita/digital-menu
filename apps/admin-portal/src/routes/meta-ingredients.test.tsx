import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetaIngredientsPage } from "./meta-ingredients";
import {
  apiAcceptFdcCandidate,
  apiGetFdcCandidateDetail,
  apiListFdcCandidates,
  apiListIngredients,
  apiListPendingIngredients,
  apiRejectFdcCandidate,
  apiSearchIngredients
} from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiListPendingIngredients: vi.fn(),
  apiApproveIngredient: vi.fn(),
  apiRejectIngredient: vi.fn(),
  apiListFdcCandidates: vi.fn(),
  apiGetFdcCandidateDetail: vi.fn(),
  apiAcceptFdcCandidate: vi.fn(),
  apiRejectFdcCandidate: vi.fn(),
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
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 10,
        ingredientId: 3,
        ingredientCanonicalName: "Sumac",
        fdcId: 174962,
        fdcDescription: "Spices, sumac",
        fdcDataType: "sr_legacy_food",
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
    expect(screen.getByText("SR Legacy")).toBeInTheDocument();

    const row = screen.getByText("Sumac").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(apiAcceptFdcCandidate).toHaveBeenCalledWith(10));
  });

  it("shows a confirmation before rejecting a match", async () => {
    const user = userEvent.setup();
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
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

  it("opens a detail dialog with full ingredient + fdc info when a row is clicked", async () => {
    const user = userEvent.setup();
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 10,
        ingredientId: 3,
        ingredientCanonicalName: "Sumac",
        fdcId: 174962,
        fdcDescription: "Spices, sumac",
        fdcDataType: "sr_legacy_food",
        score: 0.45,
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    (apiGetFdcCandidateDetail as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      candidate: {
        id: 10,
        fdcId: 174962,
        fdcDescription: "Spices, sumac",
        fdcDataType: "sr_legacy_food",
        score: 0.45,
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      ingredient: {
        id: 3,
        canonicalName: "Sumac",
        slug: "sumac",
        description: "Tart Middle Eastern spice",
        isCommonAllergen: false,
        approvalStatus: "approved",
        aliases: [{ id: 1, alias: "Sumak", languageCode: "en" }],
        media: []
      },
      fdc: {
        fdcId: 174962,
        description: "Spices, sumac",
        dataType: "sr_legacy_food",
        foodCategory: "Spices and Herbs",
        nutrients: [{ name: "Energy", unitName: "KCAL", amount: 300, rank: 300 }],
        portions: [{ amount: 1, unit: "tsp", portionDescription: null, modifier: null, gramWeight: 2 }]
      }
    });

    renderPage();

    await screen.findByText("Sumac", {}, { timeout: 3000 });
    const row = screen.getByText("Sumac").closest("li")!;
    await user.click(row);

    await screen.findByText("Review FDC match");
    expect(apiGetFdcCandidateDetail).toHaveBeenCalledWith(10);
    expect(await screen.findByText("Tart Middle Eastern spice")).toBeInTheDocument();
    expect(screen.getByText("Spices and Herbs")).toBeInTheDocument();
    expect(screen.getByText(/Energy/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no candidates", async () => {
    (apiListPendingIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiListFdcCandidates as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiSearchIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderPage();

    await screen.findByText("No pending FDC matches to review.");
  });
});
