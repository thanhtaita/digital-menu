"use client";

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

interface AvatarOrGradientProps {
  avatarUrl?: string | null;
  seed: string;
  size?: number;
}

export function AvatarOrGradient({ avatarUrl, seed, size = 36 }: AvatarOrGradientProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          flexShrink: 0
        }}
      />
    );
  }

  const h = hashStr(seed);
  const c1 = deriveOklch(h, 0);
  const c2 = deriveOklch(h, 1);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 40% 40%, ${c1}, ${c2})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: Math.round(size * 0.38),
          color: "rgba(255,255,255,0.85)",
          textTransform: "uppercase",
          userSelect: "none"
        }}
      >
        {seed.charAt(0)}
      </span>
    </div>
  );
}
