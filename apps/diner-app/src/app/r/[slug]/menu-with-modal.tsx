"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PublicMenuResponse,
  PublicDishIngredient,
} from "@digital-menu/shared";
import { resolvePublicImageUrl } from "@/lib/image-url";
import { useAuth } from "@/lib/auth-context";
import {
  getDishStatus,
  getMatchingRestrictions,
} from "@/lib/restriction-engine";
import {
  DishGradient,
  IngredientGradient,
  RestaurantCover,
} from "@/components/dish-gradient";
import {
  MetaLine,
  SectionTitle,
  RestrictionFlag,
  NutritionPills,
} from "@/components/atoms";

type Menu = PublicMenuResponse["menus"][number];
type Section = Menu["sections"][number];
type Dish = Section["dishes"][number];

function findIngredient(
  data: PublicMenuResponse,
  slug: string,
): { dish: Dish; ingredient: PublicDishIngredient; section: Section } | null {
  for (const menu of data.menus) {
    for (const section of menu.sections) {
      for (const dish of section.dishes) {
        const ingredient = dish.ingredients.find((ing) => ing.slug === slug);
        if (ingredient) return { dish, ingredient, section };
      }
    }
  }
  return null;
}

function findAllDishesWithIngredient(
  data: PublicMenuResponse,
  slug: string,
): Array<{ dish: Dish; section: Section }> {
  const results: Array<{ dish: Dish; section: Section }> = [];
  for (const menu of data.menus) {
    for (const section of menu.sections) {
      for (const dish of section.dishes) {
        if (dish.ingredients.some((ing) => ing.slug === slug)) {
          results.push({ dish, section });
        }
      }
    }
  }
  return results;
}

export function MenuWithModal({ data }: { data: PublicMenuResponse }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { restrictions, user } = useAuth();
  const restaurantSlug = data.restaurant.slug;

  const iParam = searchParams.get("i");
  const selection = useMemo(
    () => (iParam ? findIngredient(data, iParam) : null),
    [data, iParam],
  );
  const alsoIn = useMemo(
    () => (iParam ? findAllDishesWithIngredient(data, iParam) : []),
    [data, iParam],
  );

  const [sheetClosing, setSheetClosing] = useState(false);

  const requestSheetClose = useCallback(() => {
    if (sheetClosing || !selection) return;
    setSheetClosing(true);
  }, [sheetClosing, selection]);

  useEffect(() => {
    if (!sheetClosing) return;
    const t = window.setTimeout(() => {
      router.replace(`/r/${restaurantSlug}`, { scroll: false });
    }, 320);
    return () => window.clearTimeout(t);
  }, [sheetClosing, router, restaurantSlug]);

  useEffect(() => {
    if (selection != null) setSheetClosing(false);
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestSheetClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selection, requestSheetClose]);

  const hasDishes = data.menus.some((m) =>
    m.sections.some((s) => s.dishes.length > 0),
  );

  return (
    <>
      <div style={{ background: "var(--paper)", minHeight: "100vh" }}>
        {/* Sticky top bar — full-width with inner constraint */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            background: "var(--paper)",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--inkMuted)",
                textDecoration: "none",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path
                  d="M7 1L2 5l5 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              All menus
            </Link>
            <Link
              href={user ? "/profile" : "/login"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                border: "1px solid var(--rule)",
                borderRadius: 999,
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              {user
                ? (user.displayName ?? user.email ?? "Profile")
                : "Preferences"}
            </Link>
          </div>
        </div>

        {/* Constrained body */}
        <div style={{ maxWidth: 1024, margin: "0 auto", paddingBottom: 40 }}>
          {/* Restaurant header */}
          <div style={{ padding: "18px 20px 0" }}>
            <MetaLine>{data.restaurant.slug}</MetaLine>
            <h1
              style={{
                fontFamily: "var(--display)",
                fontWeight: 400 as CSSProperties["fontWeight"],
                fontSize: 54,
                lineHeight: 0.95,
                letterSpacing: -1.5,
                color: "var(--ink)",
                margin: "10px 0 0",
              }}
            >
              {data.restaurant.name}
            </h1>
            {data.restaurant.description && (
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontSize: 18,
                  fontStyle: "italic",
                  color: "var(--inkMuted)",
                  marginTop: 4,
                }}
              >
                {data.restaurant.description}
              </div>
            )}
          </div>

          {/* Cover gradient */}
          <div style={{ padding: "16px 20px 0" }}>
            <RestaurantCover
              name={data.restaurant.name}
              style={{ height: 140, borderRadius: "var(--cardRadius)" }}
            >
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: 12,
                  fontFamily: "var(--display)",
                  fontSize: 96,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.9)",
                  lineHeight: 0.8,
                }}
              >
                {data.restaurant.name[0]}
              </div>
            </RestaurantCover>
          </div>

          {/* Menu sections */}
          {!hasDishes ? (
            <div
              style={{
                padding: "40px 20px",
                fontFamily: "var(--ui)",
                fontSize: 14,
                color: "var(--inkFaint)",
                textAlign: "center",
              }}
            >
              No published menu yet. Check back soon.
            </div>
          ) : (
            data.menus.map((menu) =>
              menu.sections.map((section, secIdx) => {
                const visibleDishes = section.dishes;
                if (visibleDishes.length === 0) return null;
                return (
                  <div key={section.id}>
                    <SectionTitle
                      number={secIdx + 1}
                      title={section.name}
                      subtitle={`${visibleDishes.length} dish${visibleDishes.length !== 1 ? "es" : ""}`}
                    />
                    <div style={{ padding: "0 20px" }}>
                      {visibleDishes.map((dish, i) => {
                        const status = getDishStatus(
                          restrictions,
                          dish.ingredients,
                        );
                        const matches = getMatchingRestrictions(
                          restrictions,
                          dish.ingredients,
                        );
                        return (
                          <DishCard
                            key={dish.id}
                            dish={dish}
                            section={section}
                            index={i + 1}
                            isLast={i === visibleDishes.length - 1}
                            restaurantSlug={restaurantSlug}
                            status={status}
                            matchCount={matches.length}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              }),
            )
          )}

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
            theMenu · {data.restaurant.name}
          </div>
        </div>
        {/* end constrained body */}
      </div>

      {/* Bottom-sheet ingredient overlay (div, not <dialog>) */}
      {selection ? (
        <div
          className="ingredient-sheet-root"
          onClick={requestSheetClose}
          role="presentation"
        >
          <div
            className={`sheet-panel${sheetClosing ? " sheet-panel--exiting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={selection.ingredient.canonicalName}
            onClick={(e) => e.stopPropagation()}
          >
            <IngredientSheet
              ingredient={selection.ingredient}
              dish={selection.dish}
              alsoIn={alsoIn}
              onDismiss={requestSheetClose}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ─── Dish card (editorial layout) ─────────────────────────────────────────── */

function DishCard({
  dish,
  section,
  index,
  isLast,
  restaurantSlug,
  status,
  matchCount,
}: {
  dish: Dish;
  section: Section;
  index: number;
  isLast: boolean;
  restaurantSlug: string;
  status: "safe" | "warn" | "blocked";
  matchCount: number;
}) {
  const price = dish.price ? `$${parseFloat(dish.price).toFixed(2)}` : null;
  const ingredientSlugs = dish.ingredients.slice(0, 3).map((i) => i.slug);

  return (
    <div
      id={`dish-${dish.id}`}
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--rule)",
        padding: "18px 0",
        opacity: dish.isAvailable ? 1 : 0.6,
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Index number */}
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            color: "var(--inkFaint)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            minWidth: 28,
            paddingTop: 6,
            flexShrink: 0,
          }}
        >
          {String(index).padStart(2, "0")}
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 400 as CSSProperties["fontWeight"],
                fontSize: 22,
                letterSpacing: -0.3,
                lineHeight: 1.1,
                color: "var(--ink)",
              }}
            >
              {dish.name}
            </div>
            {!dish.isAvailable && (
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--inkFaint)",
                  border: "1px solid var(--rule)",
                  padding: "2px 6px",
                  borderRadius: 999,
                }}
              >
                Unavailable
              </span>
            )}
          </div>

          {dish.description && (
            <div
              style={{
                fontFamily: "var(--ui)",
                fontSize: 13,
                color: "var(--ink)",
                marginTop: 8,
                lineHeight: 1.45,
              }}
            >
              {dish.description}
            </div>
          )}

          {matchCount > 0 && (
            <div style={{ marginTop: 10 }}>
              <RestrictionFlag
                label={
                  status === "blocked"
                    ? "Contains allergen"
                    : "Contains flagged ingredient"
                }
              />
            </div>
          )}

          {/* Ingredient pills — tappable */}
          {dish.ingredients.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
              }}
            >
              {dish.ingredients.map((ing) => {
                const flagged = ing.isCommonAllergen;
                return (
                  <Link
                    key={ing.id}
                    href={`/r/${restaurantSlug}?i=${encodeURIComponent(ing.slug)}`}
                    scroll={false}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 8px 5px 6px",
                      border: `1px solid ${flagged ? "color-mix(in oklch, var(--warn) 40%, transparent)" : "var(--rule)"}`,
                      borderRadius: 999,
                      background: flagged
                        ? "color-mix(in oklch, var(--warn) 6%, var(--paper))"
                        : "var(--paper)",
                      textDecoration: "none",
                    }}
                  >
                    <IngredientGradient
                      slug={ing.slug}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--ui)",
                        fontSize: 12,
                        fontWeight: 500,
                        color: flagged ? "var(--warn)" : "var(--ink)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ing.canonicalName}
                      {ing.isOptional && (
                        <span style={{ opacity: 0.55, marginLeft: 3 }}>
                          (opt)
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Gradient thumbnail + price */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <DishGradient
            dishId={dish.id}
            ingredientSlugs={ingredientSlugs}
            sectionName={section.name}
            style={{ width: 68, height: 68, borderRadius: "var(--radius)" }}
          />
          {price && (
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--ink)",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {price}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Ingredient bottom sheet ───────────────────────────────────────────────── */

function IngredientSheet({
  ingredient,
  dish,
  alsoIn,
  onDismiss,
}: {
  ingredient: PublicDishIngredient;
  dish: Dish;
  alsoIn: Array<{ dish: Dish; section: Section }>;
  onDismiss: () => void;
}) {
  const nutrients = ingredient.nutrients as
    | Record<string, unknown>
    | null
    | undefined;
  const imageSrc = resolvePublicImageUrl(ingredient.imageUrl);

  return (
    <>
      {/* Grab handle (phone / tablet); Close lives in sheet-chrome-desktop */}
      <div className="sheet-chrome-mobile">
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 4,
            background: "var(--rule)",
          }}
        />
      </div>
      <div className="sheet-chrome-desktop">
        <button
          type="button"
          className="sheet-close-btn"
          onClick={onDismiss}
        >
          Close
        </button>
      </div>

      {/* Gradient header */}
      <div
        style={{ padding: "8px 20px 0", flexShrink: 0, position: "relative" }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            style={{
              height: 140,
              width: "100%",
              objectFit: "cover",
              borderRadius: "var(--cardRadius)",
              display: "block",
            }}
          />
        ) : (
          <IngredientGradient
            slug={ingredient.slug}
            style={{ height: 140, borderRadius: "var(--cardRadius)" }}
          />
        )}
        {ingredient.commonAllergenGroup && (
          <div
            style={{
              position: "absolute",
              left: 32,
              bottom: 14,
              fontFamily: "var(--mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <span
              style={{
                padding: "3px 8px",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 999,
                backdropFilter: "blur(8px)",
              }}
            >
              {ingredient.commonAllergenGroup}
            </span>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px 24px" }}>
        {/* Title row */}
        <div style={{ minWidth: 0 }}>
          <MetaLine>Ingredient · {ingredient.slug}</MetaLine>
          <div
            style={{
              fontFamily: "var(--display)",
              fontWeight: 400 as CSSProperties["fontWeight"],
              fontSize: 34,
              lineHeight: 1.05,
              color: "var(--ink)",
              letterSpacing: -0.5,
              marginTop: 4,
            }}
          >
            {ingredient.canonicalName}
          </div>
          <div
            style={{
              fontFamily: "var(--ui)",
              fontSize: 12,
              color: "var(--inkMuted)",
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            On: {dish.name}
          </div>
        </div>

        {/* Allergen warning */}
        {ingredient.isCommonAllergen && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: "var(--radius)",
              background: "color-mix(in oklch, var(--warn) 10%, var(--paper))",
              border:
                "1px solid color-mix(in oklch, var(--warn) 30%, transparent)",
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontFamily: "var(--ui)",
              fontSize: 12,
              color: "var(--warn)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle
                cx="7"
                cy="7"
                r="6"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M7 4v4M7 10v0.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <b
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: 10.5,
                }}
              >
                Common allergen
              </b>
              {ingredient.commonAllergenGroup
                ? ` · ${ingredient.commonAllergenGroup}`
                : ""}
            </div>
          </div>
        )}

        {/* Pull-quote description */}
        {ingredient.description && (
          <>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 400 as CSSProperties["fontWeight"],
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
              &ldquo;{ingredient.description}&rdquo;
            </div>
          </>
        )}

        {/* Nutrients */}
        {nutrients && Object.keys(nutrients).length > 0 && (
          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              border: "1px solid var(--rule)",
              borderRadius: "var(--cardRadius)",
              background: "var(--paperAlt)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <MetaLine>Nutrients · per serving</MetaLine>
              <span
                style={{
                  fontFamily: "var(--ui)",
                  fontSize: 11,
                  color: "var(--inkFaint)",
                }}
              >
                approx.
              </span>
            </div>
            <NutritionPills nutrients={nutrients} />
          </div>
        )}

        {/* Also on this menu */}
        {alsoIn.length > 1 && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                paddingBottom: 10,
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <MetaLine color="var(--inkMuted)">
                On this menu · {alsoIn.length}×
              </MetaLine>
              <span
                style={{
                  fontFamily: "var(--ui)",
                  fontSize: 11,
                  color: "var(--inkFaint)",
                }}
              >
                tap to navigate
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {alsoIn.map(({ dish: d, section: sec }, i) => (
                <button
                  key={d.id}
                  onClick={() => {
                    onDismiss();
                    setTimeout(() => {
                      document
                        .getElementById(`dish-${d.id}`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }, 350);
                  }}
                  style={{
                    all: "unset" as CSSProperties["all"],
                    cursor: "pointer",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom:
                      i === alsoIn.length - 1
                        ? "none"
                        : "1px solid var(--rule)",
                  }}
                >
                  <DishGradient
                    dishId={d.id}
                    ingredientSlugs={d.ingredients
                      .slice(0, 3)
                      .map((ing) => ing.slug)}
                    sectionName={sec.name}
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--display)",
                        fontWeight: 400 as CSSProperties["fontWeight"],
                        fontSize: 17,
                        color: "var(--ink)",
                        lineHeight: 1.2,
                      }}
                    >
                      {d.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--ui)",
                        fontSize: 11.5,
                        color: "var(--inkFaint)",
                        marginTop: 2,
                      }}
                    >
                      {sec.name}
                      {d.price ? ` · $${parseFloat(d.price).toFixed(2)}` : ""}
                    </div>
                  </div>
                  <svg
                    width="10"
                    height="14"
                    viewBox="0 0 10 14"
                    style={{ color: "var(--inkFaint)", flexShrink: 0 }}
                  >
                    <path
                      d="M2 2l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
