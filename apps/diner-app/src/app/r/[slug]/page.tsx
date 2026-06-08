import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicMenu } from "@/lib/public-menu";
import { MenuWithModal } from "./menu-with-modal";
import { RestaurantPostsTab } from "@/components/social/RestaurantPostsTab";
import { SiteHeader } from "@/components/site-header";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicMenu(slug);
  if (!data) return { title: "Menu" };
  return {
    title: `${data.restaurant.name} · Menu`,
    description: data.restaurant.description ?? `Menu for ${data.restaurant.name}`
  };
}

export default async function RestaurantMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const data = await fetchPublicMenu(slug);
  if (!data) notFound();

  const activeTab = tab === "posts" ? "posts" : "menu";

  const tabStyle = (active: boolean) =>
    ({
      fontFamily: "var(--mono)",
      fontSize: 10,
      textTransform: "uppercase" as const,
      letterSpacing: "0.1em",
      color: active ? "var(--ink)" : "var(--inkFaint)",
      textDecoration: "none",
      padding: "8px 0",
      borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
      display: "inline-block"
    } as React.CSSProperties);

  return (
    <>
      {activeTab === "menu" ? (
        <Suspense
          fallback={
            <div className="mx-auto max-w-2xl px-4 py-16 text-center text-stone-500">Loading menu…</div>
          }
        >
          <MenuWithModal
            data={data}
            tabBar={
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  borderBottom: "1px solid var(--rule)",
                  marginBottom: 8
                }}
              >
                <a href={`/r/${slug}`} style={tabStyle(true)}>Menu</a>
                <a href={`/r/${slug}?tab=posts`} style={tabStyle(false)}>Posts</a>
                <a href={`/r/${slug}/chat`} style={tabStyle(false)}>AI Picks</a>
              </div>
            }
          />
        </Suspense>
      ) : (
        <div className="min-h-screen bg-[var(--paper)]">
          <SiteHeader />
          <main className="mx-auto w-full max-w-[1024px] px-6 py-8">
            <h1
              style={{
                fontFamily: "var(--display)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--ink)",
                margin: "0 0 4px",
                letterSpacing: -0.5
              }}
            >
              {data.restaurant.name}
            </h1>

            <div
              style={{
                display: "flex",
                gap: 24,
                borderBottom: "1px solid var(--rule)",
                marginBottom: 24
              }}
            >
              <a href={`/r/${slug}`} style={tabStyle(false)}>Menu</a>
              <a href={`/r/${slug}?tab=posts`} style={tabStyle(true)}>Posts</a>
              <a href={`/r/${slug}/chat`} style={tabStyle(false)}>AI Picks</a>
            </div>

            <RestaurantPostsTab
              slug={slug}
              restaurantId={data.restaurant.id}
              restaurantName={data.restaurant.name}
            />
          </main>
        </div>
      )}
    </>
  );
}
