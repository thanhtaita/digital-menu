"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  apiSendChatMessageStream,
  apiGetChatHistory,
  apiClearChat,
  apiGetPublicMenu,
  apiLikeDishRecommendation,
  type ChatMessage,
  type ChatRecommendation,
  type ChatHistory
} from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";
import { DishGradient } from "@/components/dish-gradient";
import type { PublicMenuResponse } from "@digital-menu/shared";

type Menu = PublicMenuResponse["menus"][number];
type Section = Menu["sections"][number];
type Dish = Section["dishes"][number];

type LocalMessage = ChatMessage & {
  recommendations?: ChatRecommendation[];
  isOptimistic?: boolean;
  isStreaming?: boolean;
};

export default function ChatPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const router = useRouter();
  const { user, loading } = useAuth();

  const [history, setHistory] = useState<ChatHistory | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [menuData, setMenuData] = useState<PublicMenuResponse | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<{ dish: Dish; section: Section } | null>(null);
  const [dishSheetClosing, setDishSheetClosing] = useState(false);
  const [likedDishes, setLikedDishes] = useState<Set<string>>(new Set());
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

    apiGetPublicMenu(slug)
      .then(setMenuData)
      .catch(() => {});
  }, [user, slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const requestDishSheetClose = useCallback(() => {
    setDishSheetClosing(true);
  }, []);

  useEffect(() => {
    if (!selectedDish) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestDishSheetClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedDish, requestDishSheetClose]);

  useEffect(() => {
    if (!dishSheetClosing) return;
    const t = window.setTimeout(() => {
      setSelectedDish(null);
      setDishSheetClosing(false);
    }, 320);
    return () => window.clearTimeout(t);
  }, [dishSheetClosing]);

  function findDishByName(name: string): { dish: Dish; section: Section } | null {
    if (!menuData) return null;
    const normalized = name.toLowerCase().trim();
    for (const menu of menuData.menus) {
      for (const section of menu.sections) {
        for (const dish of section.dishes) {
          if (dish.name.toLowerCase().trim() === normalized) {
            return { dish, section };
          }
        }
      }
    }
    return null;
  }

  async function sendText(text: string) {
    if (!text || sending) return;

    setInput("");
    setError(null);
    setSending(true);

    const optimisticUserId = -Date.now();
    const streamingAssistantId = -(Date.now() + 1);

    const optimisticUserMsg: LocalMessage = {
      id: optimisticUserId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };
    const streamingAssistantMsg: LocalMessage = {
      id: streamingAssistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      isStreaming: true
    };

    setMessages((prev) => [...prev, optimisticUserMsg, streamingAssistantMsg]);

    try {
      await apiSendChatMessageStream(
        slug,
        text,
        (newText) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingAssistantId ? { ...m, content: m.content + newText } : m
            )
          );
        },
        (res) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === streamingAssistantId) {
                return {
                  ...m,
                  id: res.sessionId * 10000 + Date.now(),
                  content: res.message,
                  recommendations: res.recommendations.length > 0 ? res.recommendations : undefined,
                  isStreaming: false
                };
              }
              if (m.id === optimisticUserId) {
                return { ...m, isOptimistic: false };
              }
              return m;
            })
          );
          setTimeout(() => inputRef.current?.focus(), 50);
        },
        () => {
          setMessages((prev) =>
            prev.filter((m) => m.id !== streamingAssistantId && m.id !== optimisticUserId)
          );
          setError("Failed to get response. Please try again.");
        }
      );
    } catch {
      setMessages((prev) =>
        prev.filter((m) => m.id !== streamingAssistantId && m.id !== optimisticUserId)
      );
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    await sendText(input.trim());
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

  async function handleLike(dishName: string) {
    const wasLiked = likedDishes.has(dishName);
    const nowLiked = !wasLiked;
    setLikedDishes((prev) => {
      const next = new Set(prev);
      if (nowLiked) next.add(dishName); else next.delete(dishName);
      return next;
    });
    try {
      await apiLikeDishRecommendation(slug, dishName, nowLiked);
    } catch {
      setLikedDishes((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(dishName); else next.delete(dishName);
        return next;
      });
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
    <>
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
                    onClick={() => sendText(prompt)}
                    disabled={sending}
                    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 hover:border-stone-400 hover:text-stone-800 transition-colors disabled:opacity-50"
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
                  {msg.isStreaming && msg.content === "" ? (
                    <span className="inline-flex gap-1 items-center py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : (
                    <>
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-3.5 bg-stone-400 ml-0.5 align-middle animate-pulse" />
                      )}
                    </>
                  )}
                </div>

                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="space-y-2 pl-1">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">Top picks</p>
                    {msg.recommendations.map((rec, i) => {
                      const match = findDishByName(rec.dishName);
                      const isLiked = likedDishes.has(rec.dishName);
                      return (
                        <div
                          key={i}
                          className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => match && setSelectedDish(match)}
                            className={`w-full text-left px-4 py-3 ${match ? "cursor-pointer hover:bg-amber-100 transition-colors" : "cursor-default"}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-stone-900">{rec.dishName}</p>
                                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{rec.reason}</p>
                                {match && (
                                  <p className="text-xs text-amber-600 mt-1.5 font-medium">View dish →</p>
                                )}
                              </div>
                              {match && (
                                <DishGradient
                                  dishId={match.dish.id}
                                  ingredientSlugs={match.dish.ingredients.slice(0, 3).map((ing) => ing.slug)}
                                  sectionName={match.section.name}
                                  style={{ width: 52, height: 52, borderRadius: 8, flexShrink: 0 }}
                                />
                              )}
                            </div>
                          </button>
                          <div className="border-t border-amber-200 px-4 py-2">
                            <button
                              type="button"
                              onClick={() => handleLike(rec.dishName)}
                              className={`flex items-center gap-1.5 text-xs transition-colors ${
                                isLiked
                                  ? "text-rose-500 font-medium"
                                  : "text-stone-400 hover:text-rose-400"
                              }`}
                            >
                              <svg
                                width="13"
                                height="13"
                                viewBox="0 0 14 14"
                                fill={isLiked ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M7 12C7 12 1.5 8 1.5 4.75a2.625 2.625 0 0 1 5.5-.75 2.625 2.625 0 0 1 5.5.75C12.5 8 7 12 7 12z" />
                              </svg>
                              {isLiked ? "Liked" : "Like"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

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

      {/* Dish bottom sheet */}
      {selectedDish ? (
        <div
          className="ingredient-sheet-root"
          onClick={requestDishSheetClose}
          role="presentation"
        >
          <div
            className={`sheet-panel${dishSheetClosing ? " sheet-panel--exiting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={selectedDish.dish.name}
            onClick={(e) => e.stopPropagation()}
          >
            <DishSheet
              dish={selectedDish.dish}
              section={selectedDish.section}
              onDismiss={requestDishSheetClose}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function DishSheet({
  dish,
  section,
  onDismiss,
}: {
  dish: Dish;
  section: Section;
  onDismiss: () => void;
}) {
  const price = dish.price ? `$${parseFloat(dish.price).toFixed(2)}` : null;
  const ingredientSlugs = dish.ingredients.slice(0, 3).map((ing) => ing.slug);

  return (
    <>
      <div className="sheet-chrome-mobile">
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--rule)" }} />
      </div>
      <div className="sheet-chrome-desktop">
        <button type="button" className="sheet-close-btn" onClick={onDismiss}>
          Close
        </button>
      </div>

      <div style={{ padding: "8px 20px 0", flexShrink: 0 }}>
        <DishGradient
          dishId={dish.id}
          ingredientSlugs={ingredientSlugs}
          sectionName={section.name}
          style={{ height: 140, borderRadius: "var(--cardRadius)" }}
        />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px 32px" }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--inkFaint)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          {section.name}
        </div>
        <div
          style={{
            fontFamily: "var(--display)",
            fontWeight: 400,
            fontSize: 34,
            lineHeight: 1.05,
            color: "var(--ink)",
            letterSpacing: -0.5,
            marginTop: 4,
          }}
        >
          {dish.name}
        </div>
        {price && (
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 14,
              color: "var(--ink)",
              fontWeight: 600,
              marginTop: 4,
            }}
          >
            {price}
          </div>
        )}
        {!dish.isAvailable && (
          <div
            style={{
              display: "inline-block",
              marginTop: 8,
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--inkFaint)",
              border: "1px solid var(--rule)",
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            Unavailable
          </div>
        )}

        {dish.description && (
          <div
            style={{
              fontFamily: "var(--display)",
              fontWeight: 400,
              fontSize: 17,
              lineHeight: 1.35,
              color: "var(--inkMuted)",
              fontStyle: "italic",
              padding: "16px 0 14px",
              borderTop: "1px solid var(--rule)",
              borderBottom: "1px solid var(--rule)",
              marginTop: 18,
            }}
          >
            &ldquo;{dish.description}&rdquo;
          </div>
        )}

        {dish.ingredients.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--inkFaint)",
                paddingBottom: 8,
                borderBottom: "1px solid var(--rule)",
              }}
            >
              Ingredients · {dish.ingredients.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {dish.ingredients.map((ing, i) => (
                <div
                  key={ing.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: i === dish.ingredients.length - 1 ? "none" : "1px solid var(--rule)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "var(--ui)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: ing.isCommonAllergen ? "var(--warn)" : "var(--ink)",
                      }}
                    >
                      {ing.canonicalName}
                      {ing.isOptional && (
                        <span style={{ opacity: 0.55, marginLeft: 4, fontWeight: 400 }}>(opt)</span>
                      )}
                    </div>
                    {ing.isCommonAllergen && (
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 9,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          color: "var(--warn)",
                          marginTop: 2,
                        }}
                      >
                        allergen{ing.commonAllergenGroup ? ` · ${ing.commonAllergenGroup}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
