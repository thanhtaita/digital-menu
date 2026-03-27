import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MenuBuilderPage } from "./menu-builder";
import {
  apiAddDishIngredient,
  apiListDishIngredients,
  apiListDishes,
  apiListMenus,
  apiListSections,
  apiSearchIngredients
} from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiListMenus: vi.fn(),
  apiCreateMenu: vi.fn(),
  apiUpdateMenu: vi.fn(),
  apiListSections: vi.fn(),
  apiCreateSection: vi.fn(),
  apiListDishes: vi.fn(),
  apiCreateDish: vi.fn(),
  apiSearchIngredients: vi.fn(),
  apiRequestIngredient: vi.fn(),
  apiListDishIngredients: vi.fn(),
  apiAddDishIngredient: vi.fn(),
  apiRemoveDishIngredient: vi.fn()
}));

describe("MenuBuilderPage", () => {
  it("supports selecting dish and tagging ingredient", async () => {
    const user = userEvent.setup();
    (apiListMenus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, restaurantId: 7, name: "Main Menu", isPublished: false, displayOrder: 0 }
    ]);
    (apiListSections as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 2, menuId: 1, name: "Mains", displayOrder: 0 }
    ]);
    (apiListDishes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 3,
        sectionId: 2,
        name: "Pasta",
        description: null,
        price: "10.00",
        imageUrl: null,
        isAvailable: true,
        displayOrder: 0
      }
    ]);
    (apiListDishIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiSearchIngredients as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 11,
        canonicalName: "Garlic",
        slug: "garlic",
        isCommonAllergen: false,
        approvalStatus: "approved",
        requestedByRestaurantId: null
      }
    ]);
    (apiAddDishIngredient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 99,
      dishId: 3,
      ingredientId: 11,
      isOptional: false,
      isHidden: false,
      displayOrder: 0,
      canonicalName: "Garlic",
      slug: "garlic"
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/app/restaurants/7/builder"]}>
          <Routes>
            <Route path="/app/restaurants/:restaurantId/builder" element={<MenuBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole("button", { name: "Main Menu" }));
    await user.click(await screen.findByRole("button", { name: "Mains" }));
    await user.click(await screen.findByRole("button", { name: "Pasta ($10.00)" }));

    const ingredientInput = screen.getByPlaceholderText("Search ingredient (garlic, milk...)");
    await user.type(ingredientInput, "gar");
    await user.click(await screen.findByRole("button", { name: "Garlic" }));

    await waitFor(() =>
      expect(apiAddDishIngredient).toHaveBeenCalledWith(3, { ingredientId: 11 })
    );
  });
});

