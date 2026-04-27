"use client";

import type { CSSProperties, ReactNode } from "react";

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function deriveOklch(hash: number, idx: number): string {
  const hue = (hash * 47 + idx * 131) % 360;
  const l = (0.5 + ((hash >> (idx * 3)) % 25) / 100).toFixed(2);
  const c = (0.06 + ((hash >> idx) % 10) / 100).toFixed(3);
  return `oklch(${l} ${c} ${hue})`;
}

interface DishGradientProps {
  dishId: string | number;
  ingredientSlugs?: string[];
  sectionName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function DishGradient({
  dishId,
  ingredientSlugs = [],
  sectionName = "",
  style,
  children,
}: DishGradientProps) {
  const h = hashStr(String(dishId));

  const c1 = ingredientSlugs[0]
    ? deriveOklch(hashStr(ingredientSlugs[0]), 0)
    : deriveOklch(h, 0);
  const c2 = ingredientSlugs[1]
    ? deriveOklch(hashStr(ingredientSlugs[1]), 1)
    : deriveOklch(h, 1);
  const c3 = ingredientSlugs[2]
    ? deriveOklch(hashStr(ingredientSlugs[2]), 2)
    : deriveOklch(h, 2);

  const lower = sectionName.toLowerCase();
  const shape = lower.includes("ramen")
    ? "ramen"
    : lower.includes("sushi")
      ? "sushi"
      : "plate";

  const offsetX = h % 30;
  const offsetY = (h >> 3) % 30;
  const rotation = (h % 40) - 20;
  const noiseId = `dn-${dishId}`;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(120% 90% at ${20 + offsetX}% ${30 + offsetY}%, ${c2}, ${c1} 55%, ${c3} 120%)`,
        ...style,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "soft-light",
          opacity: 0.8,
        }}
      >
        <defs>
          <filter id={noiseId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="2"
              seed={h % 10}
            />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>

      {shape === "ramen" && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: "absolute",
            inset: 0,
            transform: `rotate(${rotation}deg)`,
          }}
        >
          <g stroke={c3} strokeWidth="0.4" fill="none" opacity="0.55">
            <circle cx="50" cy="60" r="38" />
            <circle cx="50" cy="60" r="28" />
            <circle cx="50" cy="60" r="18" />
          </g>
          <g stroke={c1} strokeWidth="0.6" fill="none" opacity="0.7" strokeLinecap="round">
            {[...Array(4)].map((_, i) => (
              <path
                key={i}
                d={`M ${20 + i * 5} ${45 + i * 3} Q 50 ${35 + i * 2}, ${80 - i * 3} ${55 + i * 2}`}
              />
            ))}
          </g>
        </svg>
      )}

      {shape === "sushi" && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0 }}
        >
          <g opacity="0.7">
            <ellipse cx={35} cy={62} rx="18" ry="7" fill={c3} opacity="0.5" />
            <ellipse cx={35} cy={58} rx="18" ry="5" fill={c2} opacity="0.8" />
            <ellipse cx={68} cy={48} rx="16" ry="6" fill={c3} opacity="0.4" />
            <ellipse cx={68} cy={44} rx="16" ry="4.5" fill={c1} opacity="0.8" />
          </g>
        </svg>
      )}

      {shape === "plate" && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0 }}
        >
          <g fill="none" stroke={c3} strokeWidth="0.3" opacity="0.5">
            <circle cx="50" cy="55" r="32" />
            <circle cx="50" cy="55" r="22" />
          </g>
          <circle cx="50" cy="55" r="18" fill={c2} opacity="0.5" />
        </svg>
      )}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.12))",
        }}
      />

      {children}
    </div>
  );
}

export function IngredientGradient({
  slug,
  style,
}: {
  slug: string;
  style?: CSSProperties;
}) {
  const h = hashStr(slug);
  const c1 = deriveOklch(h, 0);
  const c2 = deriveOklch(h, 1);
  const safeId = slug.replace(/[^a-z0-9]/g, "");
  const noiseId = `ing-${safeId}`;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(120% 100% at 30% 30%, ${c1}, ${c2})`,
        ...style,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "soft-light",
          opacity: 0.7,
        }}
      >
        <defs>
          <filter id={noiseId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.1"
              numOctaves="2"
              seed={h % 10}
            />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>
    </div>
  );
}

export function RestaurantCover({
  name,
  style,
  children,
}: {
  name: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const h = hashStr(name);
  const c1 = deriveOklch(h, 0);
  const c2 = deriveOklch(h, 2);
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(120% 100% at 30% 30%, ${c1}, ${c2})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
