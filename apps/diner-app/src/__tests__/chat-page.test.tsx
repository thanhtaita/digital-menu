import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ChatPage from "../app/r/[slug]/chat/page";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

// Render next/link as a plain <a> — no Next.js router required.
vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <a href={props.href} className={props.className}>{props.children}</a>,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiSendChatMessage: vi.fn(),
  apiGetChatHistory: vi.fn(),
  apiClearChat: vi.fn(),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiSendChatMessage, apiGetChatHistory, apiClearChat } from "@/lib/api-client";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SLUG = "sushi-bar";
const MOCK_USER = { id: 1, email: "diner@test.com", role: "diner" };

const EMPTY_HISTORY = { restaurantName: "Sushi Bar", messages: [], summary: null };

const HISTORY_WITH_MESSAGES = {
  restaurantName: "Sushi Bar",
  messages: [
    { id: 1, role: "user" as const, content: "What's good here?", createdAt: "2026-06-07T10:00:00.000Z" },
    { id: 2, role: "assistant" as const, content: "Try the Spicy Ramen!", createdAt: "2026-06-07T10:00:01.000Z" },
  ],
  summary: null,
};

// ─── Default mock setup ───────────────────────────────────────────────────────

function setupDefaults() {
  vi.mocked(useParams).mockReturnValue({ slug: SLUG });
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as never);
  vi.mocked(useAuth).mockReturnValue({ user: MOCK_USER, loading: false } as never);
  vi.mocked(apiGetChatHistory).mockResolvedValue(EMPTY_HISTORY);
  vi.mocked(apiSendChatMessage).mockResolvedValue({
    message: "I recommend the Spicy Ramen!",
    recommendations: [],
    sessionId: 1,
  });
  vi.mocked(apiClearChat).mockResolvedValue(undefined);
  // Replace window.confirm with a mock that confirms by default.
  vi.spyOn(window, "confirm").mockReturnValue(true);
}

beforeEach(() => {
  vi.resetAllMocks();
  setupDefaults();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ChatPage", () => {

  // ── Auth and loading ────────────────────────────────────────────────────────

  describe("auth and loading", () => {
    it("shows loading screen while auth check is in progress", () => {
      vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);
      render(<ChatPage />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });

    it("redirects to /login when the user is not authenticated", async () => {
      const mockPush = vi.fn();
      vi.mocked(useRouter).mockReturnValue({ push: mockPush } as never);
      vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never);
      render(<ChatPage />);
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    });

    it("shows loading screen while chat history is being fetched", () => {
      // Never-resolving promise keeps the component in the loading state.
      vi.mocked(apiGetChatHistory).mockReturnValue(new Promise(() => {}));
      render(<ChatPage />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });
  });

  // ── History loading ─────────────────────────────────────────────────────────

  describe("history loading", () => {
    it("calls apiGetChatHistory with the restaurant slug on mount", async () => {
      render(<ChatPage />);
      await screen.findByPlaceholderText("Ask for a recommendation…");
      expect(apiGetChatHistory).toHaveBeenCalledWith(SLUG);
    });

    it("displays the restaurant name from history in the header", async () => {
      render(<ChatPage />);
      expect(await screen.findByRole("heading", { name: "Sushi Bar" })).toBeInTheDocument();
    });

    it("renders existing messages from history", async () => {
      vi.mocked(apiGetChatHistory).mockResolvedValue(HISTORY_WITH_MESSAGES);
      render(<ChatPage />);
      expect(await screen.findByText("What's good here?")).toBeInTheDocument();
      expect(screen.getByText("Try the Spicy Ramen!")).toBeInTheDocument();
    });

    it("shows an error banner when history fails to load", async () => {
      vi.mocked(apiGetChatHistory).mockRejectedValue(new Error("Network error"));
      render(<ChatPage />);
      expect(await screen.findByText("Failed to load conversation history.")).toBeInTheDocument();
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows welcome message and starter chips when there are no messages", async () => {
      render(<ChatPage />);
      expect(await screen.findByText("What are you in the mood for?")).toBeInTheDocument();
      expect(screen.getByText("What's popular?")).toBeInTheDocument();
      expect(screen.getByText("Something light")).toBeInTheDocument();
      expect(screen.getByText("I'm feeling adventurous")).toBeInTheDocument();
    });

    it("clicking a starter chip fills the input field", async () => {
      const user = userEvent.setup();
      render(<ChatPage />);
      await screen.findByText("What's popular?");
      await user.click(screen.getByText("What's popular?"));
      expect(screen.getByPlaceholderText("Ask for a recommendation…")).toHaveValue("What's popular?");
    });
  });

  // ── Sending messages ────────────────────────────────────────────────────────

  describe("sending messages", () => {
    it("sends the message and displays the assistant reply", async () => {
      const user = userEvent.setup();
      render(<ChatPage />);
      const input = await screen.findByPlaceholderText("Ask for a recommendation…");
      await user.type(input, "What should I try?");
      await user.click(screen.getByRole("button", { name: /send/i }));
      expect(await screen.findByText("I recommend the Spicy Ramen!")).toBeInTheDocument();
    });

    it("calls apiSendChatMessage with the correct slug and trimmed message", async () => {
      const user = userEvent.setup();
      render(<ChatPage />);
      const input = await screen.findByPlaceholderText("Ask for a recommendation…");
      await user.type(input, "What should I try?");
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByText("I recommend the Spicy Ramen!");
      expect(apiSendChatMessage).toHaveBeenCalledWith(SLUG, "What should I try?");
    });

    it("renders recommendation cards when the response includes recommendations", async () => {
      vi.mocked(apiSendChatMessage).mockResolvedValue({
        message: "You'd love these!",
        recommendations: [
          { dishName: "Tonkotsu Ramen", reason: "Rich and satisfying for cold days" },
        ],
        sessionId: 1,
      });
      const user = userEvent.setup();
      render(<ChatPage />);
      const input = await screen.findByPlaceholderText("Ask for a recommendation…");
      await user.type(input, "Something hearty");
      await user.click(screen.getByRole("button", { name: /send/i }));
      expect(await screen.findByText("Tonkotsu Ramen")).toBeInTheDocument();
      expect(screen.getByText("Rich and satisfying for cold days")).toBeInTheDocument();
    });

    it("shows an error banner and removes the optimistic message when send fails", async () => {
      vi.mocked(apiSendChatMessage).mockRejectedValue(new Error("Server error"));
      const user = userEvent.setup();
      render(<ChatPage />);
      const input = await screen.findByPlaceholderText("Ask for a recommendation…");
      await user.type(input, "Hello there");
      await user.click(screen.getByRole("button", { name: /send/i }));
      expect(await screen.findByText("Failed to send message. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText("Hello there")).not.toBeInTheDocument();
    });

    it("disables the send button when the input is empty", async () => {
      render(<ChatPage />);
      await screen.findByPlaceholderText("Ask for a recommendation…");
      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    });

    it("enables the send button once the user types something", async () => {
      const user = userEvent.setup();
      render(<ChatPage />);
      const input = await screen.findByPlaceholderText("Ask for a recommendation…");
      await user.type(input, "a");
      expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
    });
  });

  // ── Clear conversation ──────────────────────────────────────────────────────

  describe("clear conversation", () => {
    it("does not show a clear button when there are no messages", async () => {
      render(<ChatPage />);
      await screen.findByPlaceholderText("Ask for a recommendation…");
      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
    });

    it("shows a clear button when messages are present", async () => {
      vi.mocked(apiGetChatHistory).mockResolvedValue(HISTORY_WITH_MESSAGES);
      render(<ChatPage />);
      expect(await screen.findByRole("button", { name: /clear/i })).toBeInTheDocument();
    });

    it("clears all messages and calls apiClearChat when the user confirms", async () => {
      vi.mocked(apiGetChatHistory).mockResolvedValue(HISTORY_WITH_MESSAGES);
      const user = userEvent.setup();
      render(<ChatPage />);
      const clearBtn = await screen.findByRole("button", { name: /clear/i });
      await user.click(clearBtn);
      await waitFor(() =>
        expect(screen.queryByText("What's good here?")).not.toBeInTheDocument()
      );
      expect(apiClearChat).toHaveBeenCalledWith(SLUG);
    });

    it("does not clear messages when the user cancels the confirmation dialog", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      vi.mocked(apiGetChatHistory).mockResolvedValue(HISTORY_WITH_MESSAGES);
      const user = userEvent.setup();
      render(<ChatPage />);
      const clearBtn = await screen.findByRole("button", { name: /clear/i });
      await user.click(clearBtn);
      expect(screen.getByText("What's good here?")).toBeInTheDocument();
      expect(apiClearChat).not.toHaveBeenCalled();
    });

    it("shows an error banner when the clear API call fails", async () => {
      vi.mocked(apiClearChat).mockRejectedValue(new Error("Clear failed"));
      vi.mocked(apiGetChatHistory).mockResolvedValue(HISTORY_WITH_MESSAGES);
      const user = userEvent.setup();
      render(<ChatPage />);
      const clearBtn = await screen.findByRole("button", { name: /clear/i });
      await user.click(clearBtn);
      expect(await screen.findByText("Failed to clear conversation.")).toBeInTheDocument();
    });
  });
});
