import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterPage } from "./register";
import { apiRegister } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiRegister: vi.fn()
}));

describe("RegisterPage", () => {
  it("submits registration payload and calls onRegistered", async () => {
    const onRegistered = vi.fn();
    const user = userEvent.setup();
    (apiRegister as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 3, email: "owner@test.com", role: "restaurant_admin" },
      restaurantId: 10
    });

    render(
      <MemoryRouter>
        <RegisterPage onRegistered={onRegistered} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Register and continue" }));

    await waitFor(() =>
      expect(apiRegister).toHaveBeenCalledWith({
        email: "owner@test.com",
        password: "password123",
        displayName: "Owner",
        restaurantName: "My Restaurant",
        restaurantSlug: "my-restaurant"
      })
    );
    expect(onRegistered).toHaveBeenCalledWith({
      id: 3,
      email: "owner@test.com",
      role: "restaurant_admin"
    });
  });
});

