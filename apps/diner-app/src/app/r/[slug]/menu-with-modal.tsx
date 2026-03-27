"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import type { PublicMenuResponse, PublicDishIngredient } from "@digital-menu/shared";

type Dish = PublicMenuResponse["menus"][number]["sections"][number]["dishes"][number];

function findIngredient(
  data: PublicMenuResponse,
  ingredientSlug: string
): { dish: Dish; ingredient: PublicDishIngredient } | null {
  for (const menu of data.menus) {
    for (const section of menu.sections) {
      for (const dish of section.dishes) {
        const ingredient = dish.ingredients.find((ing) => ing.slug === ingredientSlug);
        if (ingredient) return { dish, ingredient };
      }
    }
  }
  return null;
}

export function MenuWithModal({ data }: { data: PublicMenuResponse }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const slug = data.restaurant.slug;

  const iParam = searchParams.get("i");
  const selection = useMemo(
    () => (iParam ? findIngredient(data, iParam) : null),
    [data, iParam]
  );

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (selection) el.showModal();
    else el.close();
  }, [selection]);

  function closeModal() {
    router.replace(`/r/${slug}`, { scroll: false });
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-10 text-center">
          {data.restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.restaurant.logoUrl}
              alt=""
              className="mx-auto mb-4 h-16 w-auto object-contain"
            />
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">{data.restaurant.name}</h1>
          {data.restaurant.description ? (
            <p className="mt-2 text-stone-600">{data.restaurant.description}</p>
          ) : null}
        </header>

        {data.menus.length === 0 ? (
          <p className="text-center text-stone-500">No published menu yet. Check back soon.</p>
        ) : (
          data.menus.map((menu) => (
            <section key={menu.id} className="mb-12">
              <h2 className="mb-6 border-b border-stone-200 pb-2 text-xl font-medium text-stone-800">
                {menu.name}
              </h2>
              {menu.sections.map((section) => (
                <div key={section.id} className="mb-10">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
                    {section.name}
                  </h3>
                  <ul className="space-y-6">
                    {section.dishes.map((dish) => (
                      <li
                        key={dish.id}
                        className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${
                          !dish.isAvailable ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex gap-4">
                          {dish.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={dish.imageUrl}
                              alt=""
                              className="h-24 w-24 shrink-0 rounded-lg object-cover"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <h4 className="font-medium text-stone-900">{dish.name}</h4>
                              <span className="shrink-0 text-stone-800">${dish.price}</span>
                            </div>
                            {dish.description ? (
                              <p className="mt-1 text-sm text-stone-600">{dish.description}</p>
                            ) : null}
                            {!dish.isAvailable ? (
                              <p className="mt-2 text-xs font-medium text-amber-800">Currently unavailable</p>
                            ) : null}
                            {dish.ingredients.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {dish.ingredients.map((ing) => (
                                  <Link
                                    key={ing.id}
                                    href={`/r/${slug}?i=${encodeURIComponent(ing.slug)}`}
                                    scroll={false}
                                    className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-800 underline-offset-2 hover:border-stone-300 hover:bg-stone-100 hover:underline"
                                  >
                                    {ing.canonicalName}
                                    {ing.isOptional ? (
                                      <span className="ml-1 text-stone-500">(optional)</span>
                                    ) : null}
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="w-[min(100%,28rem)] rounded-xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-black/40"
        onClose={closeModal}
      >
        {selection ? (
          <IngredientPanel selection={selection} onDismiss={closeModal} />
        ) : (
          <div className="p-6" />
        )}
      </dialog>
    </>
  );
}

function IngredientPanel({
  selection,
  onDismiss
}: {
  selection: { dish: Dish; ingredient: PublicDishIngredient };
  onDismiss: () => void;
}) {
  const { dish, ingredient } = selection;
  const nutrients = ingredient.nutrients;
  const nutrientEntries =
    nutrients && typeof nutrients === "object" ? Object.entries(nutrients as Record<string, unknown>) : [];

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-stone-100 bg-white px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Ingredient</p>
          <h2 className="text-lg font-semibold">{ingredient.canonicalName}</h2>
          <p className="mt-0.5 text-sm text-stone-500">On: {dish.name}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="space-y-4 px-5 py-4">
        {ingredient.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ingredient.imageUrl}
            alt=""
            className="max-h-48 w-full rounded-lg object-cover"
          />
        ) : null}
        {ingredient.isCommonAllergen ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span className="font-medium">Allergen</span>
            {ingredient.commonAllergenGroup ? ` · ${ingredient.commonAllergenGroup}` : null}
          </p>
        ) : null}
        {ingredient.description ? <p className="text-sm leading-relaxed text-stone-700">{ingredient.description}</p> : null}
        {nutrientEntries.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Nutrients</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-stone-700">
              {nutrientEntries.slice(0, 12).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-stone-500">{k}</span>
                  <span className="text-right">{String(v)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
