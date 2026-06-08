"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  apiSendChatMessage,
  apiGetChatHistory,
  apiClearChat,
  type ChatMessage,
  type ChatRecommendation,
  type ChatHistory
} from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";

type LocalMessage = ChatMessage & {
  recommendations?: ChatRecommendation[];
  isOptimistic?: boolean;
};

export default function ChatPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const router = useRouter();
  const { user, loading } = useAuth();

  const [history, setHistory] = useState<ChatHistory | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !slug) return;
    apiGetChatHistory(slug)
      .then((h) => {
        setHistory(h);
        setMessages(h.messages as LocalMessage[]);
      })
      .catch(() => setError("Failed to load conversation history."))
      .finally(() => setLoadingHistory(false));
  }, [user, slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setError(null);
    setSending(true);

    const optimisticId = -Date.now();
    const optimisticMsg: LocalMessage = {
      id: optimisticId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await apiSendChatMessage(slug, text);
      const assistantMsg: LocalMessage = {
        id: res.sessionId * 10000 + Date.now(),
        role: "assistant",
        content: res.message,
        createdAt: new Date().toISOString(),
        recommendations: res.recommendations.length > 0 ? res.recommendations : undefined
      };
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        { ...optimisticMsg, isOptimistic: false },
        assistantMsg
      ]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!confirm("Clear this conversation? This cannot be undone.")) return;
    try {
      await apiClearChat(slug);
      setMessages([]);
      setHistory((prev) => (prev ? { ...prev, summary: null } : null));
    } catch {
      setError("Failed to clear conversation.");
    }
  }

  if (loading || loadingHistory) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <SiteHeader />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center text-stone-500 text-sm">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) return null;

  const restaurantName = history?.restaurantName ?? "Restaurant";

  return (
    <div className="flex flex-col h-screen bg-[var(--paper)]">
      <SiteHeader />

      {/* Chat header */}
      <div className="border-b border-stone-200 bg-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link
          href={`/r/${slug}`}
          className="text-stone-400 hover:text-stone-700 text-sm leading-none"
        >
          ← Menu
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-stone-900 truncate">{restaurantName}</h1>
          <p className="text-xs text-stone-400">AI Recommendations</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-stone-400 hover:text-red-500 flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {messages.length === 0 && !sending && (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-stone-800 font-medium text-lg">What are you in the mood for?</p>
            <p className="text-stone-400 text-sm mt-2 max-w-xs mx-auto">
              Ask me anything about the menu — I can suggest dishes based on your preferences.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["What's popular?", "Something light", "I'm feeling adventurous"].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 hover:border-stone-400 hover:text-stone-800 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[80%] space-y-2">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? `bg-stone-900 text-white rounded-br-sm ${msg.isOptimistic ? "opacity-60" : ""}`
                    : "bg-white border border-stone-200 text-stone-800 rounded-bl-sm shadow-sm"
                }`}
              >
                {msg.content}
              </div>

              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="space-y-2 pl-1">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Top picks</p>
                  {msg.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-stone-900">{rec.dishName}</p>
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <span className="text-stone-400 text-sm">Thinking…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-stone-200 bg-white px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for a recommendation…"
            disabled={sending}
            maxLength={1000}
            className="flex-1 rounded-full border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm focus:border-stone-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
