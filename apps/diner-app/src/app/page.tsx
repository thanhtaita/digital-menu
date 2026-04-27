import type { CSSProperties } from "react";
import Link from "next/link";
import { fetchPublicRestaurants } from "@/lib/public-menu";
import { MetaLine } from "@/components/atoms";
import { RestaurantCover } from "@/components/dish-gradient";

export default async function Home() {
  const restaurants = await fetchPublicRestaurants();

  return (
    <div style={{ background: "var(--paper)", minHeight: "100vh" }}>
      <div style={{ margin: "0 auto", paddingBottom: 40 }}>
        {/* Masthead */}
        <div style={{ padding: "20px 20px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <MetaLine>Diner</MetaLine>
            <Link
              href="/profile"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                border: "1px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              Profile
            </Link>
          </div>

          <div style={{ maxWidth: 1024, margin: "0 auto" }}>
            <div>
              <h1
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 400 as CSSProperties["fontWeight"],
                  fontSize: 52,
                  lineHeight: 0.95,
                  letterSpacing: -1,
                  color: "var(--ink)",
                  margin: "14px 0 0",
                }}
              >
                the
                <span style={{ color: "var(--accent)", fontStyle: "italic" }}>
                  Menu
                </span>
              </h1>

              <p
                style={{
                  fontFamily: "var(--ui)",
                  fontSize: 13,
                  color: "var(--inkMuted)",
                  marginTop: 10,
                  maxWidth: 320,
                  lineHeight: 1.5,
                }}
              >
                Read the dish. Know the ingredient. Eat with intention.
              </p>
            </div>
            {/* Section header */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "28px 20px 14px",
                borderBottom: "1px solid var(--rule)",
                marginBottom: 4,
                marginTop: 24,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: "var(--inkFaint)",
                  textTransform: "uppercase",
                  minWidth: 24,
                }}
              >
                01
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--display)",
                    fontWeight: 400 as CSSProperties["fontWeight"],
                    fontSize: 26,
                    lineHeight: 1.05,
                    color: "var(--ink)",
                    letterSpacing: -0.3,
                  }}
                >
                  Restaurants
                </div>
                <div
                  style={{
                    fontFamily: "var(--ui)",
                    fontSize: 12,
                    color: "var(--inkMuted)",
                    marginTop: 4,
                  }}
                >
                  {restaurants.length === 0
                    ? "None available yet"
                    : `${restaurants.length} ${restaurants.length === 1 ? "place" : "places"} available`}
                </div>
              </div>
            </div>

            {/* Restaurant list */}
            {restaurants.length === 0 ? (
              <div
                style={{
                  padding: "40px 20px",
                  fontFamily: "var(--ui)",
                  fontSize: 14,
                  color: "var(--inkFaint)",
                  textAlign: "center",
                }}
              >
                No restaurants yet. Check back soon.
              </div>
            ) : (
              <div style={{ padding: "0 20px" }}>
                {restaurants.map((r, i) => (
                  <Link
                    key={r.id}
                    href={`/r/${r.slug}`}
                    style={{
                      display: "block",
                      textDecoration: "none",
                      borderBottom:
                        i === restaurants.length - 1
                          ? "none"
                          : "1px solid var(--rule)",
                      padding: "18px 0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Number */}
                      <div
                        style={{
                          width: 28,
                          flexShrink: 0,
                          marginTop: 6,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            letterSpacing: "0.12em",
                            color: "var(--inkFaint)",
                            textTransform: "uppercase",
                          }}
                        >
                          № {String(i + 1).padStart(2, "0")}
                        </div>
                      </div>

                      {/* Cover */}
                      <div style={{ width: 86, flexShrink: 0 }}>
                        <RestaurantCover
                          name={r.name}
                          style={{ height: 110, borderRadius: "var(--radius)" }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "flex-end",
                              padding: "8px 10px",
                              fontFamily: "var(--display)",
                              fontWeight: 500,
                              fontSize: 32,
                              color: "rgba(255,255,255,0.9)",
                              lineHeight: 1,
                            }}
                          >
                            {r.name[0]}
                          </div>
                        </RestaurantCover>
                      </div>

                      {/* Copy */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--display)",
                            fontWeight: 400 as CSSProperties["fontWeight"],
                            fontSize: 24,
                            color: "var(--ink)",
                            letterSpacing: -0.3,
                            lineHeight: 1.1,
                          }}
                        >
                          {r.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            color: "var(--inkFaint)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          /{r.slug}
                        </div>
                        {r.description && (
                          <div
                            style={{
                              fontFamily: "var(--ui)",
                              fontSize: 13,
                              color: "var(--ink)",
                              lineHeight: 1.45,
                              marginTop: 4,
                            }}
                          >
                            {r.description}
                          </div>
                        )}
                      </div>

                      {/* Chevron */}
                      <svg
                        width="8"
                        height="14"
                        viewBox="0 0 8 14"
                        style={{
                          color: "var(--inkFaint)",
                          flexShrink: 0,
                          marginTop: 6,
                        }}
                      >
                        <path
                          d="M2 2l4 5-4 5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Colophon */}
            <div
              style={{
                padding: "40px 20px 20px",
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--inkFaint)",
                textAlign: "center",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              theMenu — MMXXVI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
