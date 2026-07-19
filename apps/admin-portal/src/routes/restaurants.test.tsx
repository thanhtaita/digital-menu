import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RestaurantsPage } from "./restaurants";
import { apiGetRestaurantQr, apiListRestaurants } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiListRestaurants: vi.fn(),
  apiUpdateRestaurant: vi.fn(),
  apiGetRestaurantQr: vi.fn()
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RestaurantsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("RestaurantsPage QR code", () => {
  it("fetches and displays the QR code with a download link", async () => {
    const user = userEvent.setup();
    (apiListRestaurants as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 7, name: "Test Bistro", slug: "test-bistro", description: null }
    ]);
    (apiGetRestaurantQr as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      "blob:http://localhost/mock-qr"
    );

    renderPage();

    await user.click(await screen.findByRole("button", { name: "QR code" }));

    await waitFor(() => expect(apiGetRestaurantQr).toHaveBeenCalledWith(7));

    const image = await screen.findByAltText("QR code linking to Test Bistro's menu");
    expect(image).toHaveAttribute("src", "blob:http://localhost/mock-qr");

    const downloadLink = screen.getByRole("link", { name: "Download PNG" });
    expect(downloadLink).toHaveAttribute("href", "blob:http://localhost/mock-qr");
    expect(downloadLink).toHaveAttribute("download", "qr-restaurant-7.png");
  });

  it("shows an error when the QR code fails to load", async () => {
    const user = userEvent.setup();
    (apiListRestaurants as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 7, name: "Test Bistro", slug: "test-bistro", description: null }
    ]);
    (apiGetRestaurantQr as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      status: 403,
      data: { error: "Forbidden" }
    });

    renderPage();

    await user.click(await screen.findByRole("button", { name: "QR code" }));

    expect(await screen.findByText("Failed to load QR code.")).toBeInTheDocument();
  });
});
