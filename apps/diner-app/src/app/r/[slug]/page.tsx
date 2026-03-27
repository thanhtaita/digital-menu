import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicMenu } from "@/lib/public-menu";
import { MenuWithModal } from "./menu-with-modal";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicMenu(slug);
  if (!data) return { title: "Menu" };
  return {
    title: `${data.restaurant.name} · Menu`,
    description: data.restaurant.description ?? `Menu for ${data.restaurant.name}`
  };
}

export default async function RestaurantMenuPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchPublicMenu(slug);
  if (!data) notFound();

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-stone-500">Loading menu…</div>
      }
    >
      <MenuWithModal data={data} />
    </Suspense>
  );
}
