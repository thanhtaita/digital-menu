import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { fetchPublicSearch } from "@/lib/public-menu";
import { SiteHeader } from "@/components/site-header";
import { SearchBox } from "@/components/search-box";
import { SectionTitle } from "@/components/atoms";
import { DishGradient, RestaurantCover } from "@/components/dish-gradient";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `“${q}” · Search · theMenu` : "Search · theMenu" };
}

const rowStyle: CSSProperties = {
  display: "block",
  textDecoration: "none",
  padding: "14px 0",
  borderBottom: "1px solid var(--rule)"
};

export default async function SearchPage({ searchParams }: Props) {
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim();
  const results = q.length >= 2 ? await fetchPublicSearch(q) : null;

  return (
    <div style={{ background: "var(--paper)", minHeight: "100vh" }}>
      <SiteHeader />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 60px" }}>
        <SearchBox defaultValue={q} />

        {!results && (
          <p
            style={{
              fontFamily: "var(--ui)",
              fontSize: 13,
              color: "var(--inkFaint)",
              marginTop: 24,
            }}
          >
            {q ? "Keep typing — need at least 2 characters." : "Search for a dish, ingredient, or restaurant."}
          </p>
        )}

        {results && results.restaurants.length === 0 && results.dishes.length === 0 && (
          <p
            style={{
              fontFamily: "var(--ui)",
              fontSize: 13,
              color: "var(--inkFaint)",
              marginTop: 24,
            }}
          >
            No matches for “{q}”.
          </p>
        )}

        {results && results.restaurants.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <SectionTitle title="Restaurants" subtitle={`${results.restaurants.length} match${results.restaurants.length === 1 ? "" : "es"}`} />
            <div>
              {results.restaurants.map((r) => (
                <Link key={r.id} href={`/r/${r.slug}`} style={rowStyle}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <RestaurantCover
                      name={r.name}
                      style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "var(--radius)" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--display)",
                          fontSize: 18,
                          color: "var(--ink)",
                          lineHeight: 1.2,
                        }}
                      >
                        {r.name}
                      </div>
                      {r.description && (
                        <div
                          style={{
                            fontFamily: "var(--ui)",
                            fontSize: 12,
                            color: "var(--inkMuted)",
                            marginTop: 2,
                          }}
                        >
                          {r.description}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {results && results.dishes.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <SectionTitle title="Dishes" subtitle={`${results.dishes.length} match${results.dishes.length === 1 ? "" : "es"}`} />
            <div>
              {results.dishes.map((d) => (
                <Link key={d.id} href={`/r/${d.restaurant.slug}#dish-${d.id}`} style={rowStyle}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <DishGradient
                      dishId={d.id}
                      style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "var(--radius)" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--display)",
                          fontSize: 18,
                          color: "var(--ink)",
                          lineHeight: 1.2,
                        }}
                      >
                        {d.name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: "var(--inkFaint)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          marginTop: 2,
                        }}
                      >
                        {d.restaurant.name}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        color: "var(--ink)",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      ${d.price}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
