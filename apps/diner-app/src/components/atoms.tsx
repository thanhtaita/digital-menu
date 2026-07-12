import type { CSSProperties, ReactNode } from "react";

export function MetaLine({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: color ?? "var(--inkFaint)",
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number?: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        padding: "28px 20px 14px",
        borderBottom: "1px solid var(--rule)",
        marginBottom: 4,
      }}
    >
      {number !== undefined && (
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
          {String(number).padStart(2, "0")}
        </div>
      )}
      <div style={{ flex: 1 }}>
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
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: "var(--ui)",
              fontSize: 12,
              color: "var(--inkMuted)",
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export function RestrictionFlag({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        fontFamily: "var(--mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--warn)",
        border: "1px solid color-mix(in oklch, var(--warn) 35%, transparent)",
        background: "color-mix(in oklch, var(--warn) 8%, var(--paper))",
        borderRadius: 999,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "var(--warn)",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}

export function NutritionPills({
  nutrients,
}: {
  nutrients: Record<string, unknown> | null | undefined;
}) {
  if (!nutrients) return null;

  const items = [
    { k: "cal", v: nutrients.cal, u: "cal" },
    { k: "fat", v: nutrients.fat, u: "g fat" },
    { k: "protein", v: nutrients.protein, u: "g protein" },
    { k: "carbs", v: nutrients.carbs, u: "g carbs" },
    { k: "sodium", v: nutrients.sodium, u: "mg sodium" },
  ].filter((it) => it.v !== undefined && it.v !== null);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        fontFamily: "var(--mono)",
        fontSize: 11.5,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {items.map((it) => (
        <div
          key={it.k}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
            padding: "5px 9px",
            border: "1px solid var(--rule)",
            borderRadius: 999,
            color: "var(--ink)",
            background: "color-mix(in oklch, var(--paper) 70%, transparent)",
          }}
        >
          <span style={{ fontWeight: 600 }}>{String(it.v)}</span>
          <span style={{ color: "var(--inkFaint)", fontSize: 10 }}>{it.u}</span>
        </div>
      ))}
    </div>
  );
}
