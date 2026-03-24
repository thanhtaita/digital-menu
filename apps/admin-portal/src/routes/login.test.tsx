import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./login";
import { apiLogin } from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  apiLogin: vi.fn()
}));

describe("LoginPage", () => {
  it("submits credentials and calls onLoggedIn", async () => {
    const onLoggedIn = vi.fn();
    const user = userEvent.setup();
    (apiLogin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 1, email: "owner@test.com", role: "restaurant_admin" }
    });

    render(
      <MemoryRouter>
        <LoginPage onLoggedIn={onLoggedIn} />
      </MemoryRouter>
    );

    const emailInput = screen.getByDisplayValue("owner@test.com");
    await user.clear(emailInput);
    await user.type(emailInput, "new@test.com");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(apiLogin).toHaveBeenCalledWith("new@test.com", "password123")
    );
    expect(onLoggedIn).toHaveBeenCalledWith({
      id: 1,
      email: "owner@test.com",
      role: "restaurant_admin"
    });
  });
});

