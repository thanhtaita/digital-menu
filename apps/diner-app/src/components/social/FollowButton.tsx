"use client";

import { useState } from "react";
import { apiFollowUser, apiUnfollowUser } from "@/lib/api-client";

interface FollowButtonProps {
  userId: number;
  initialIsFollowed: boolean;
  initialFollowerCount: number;
  onCountChange?: (newCount: number) => void;
}

export function FollowButton({ userId, initialIsFollowed, initialFollowerCount, onCountChange }: FollowButtonProps) {
  const [isFollowed, setIsFollowed] = useState(initialIsFollowed);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (isFollowed) {
        await apiUnfollowUser(userId);
        setIsFollowed(false);
        setFollowerCount((c) => Math.max(0, c - 1));
        onCountChange?.(Math.max(0, followerCount - 1));
      } else {
        await apiFollowUser(userId);
        setIsFollowed(true);
        setFollowerCount((c) => c + 1);
        onCountChange?.(followerCount + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--inkMuted)" }}>
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </span>
      <button
        onClick={toggle}
        disabled={busy}
        style={{
          padding: "5px 14px",
          borderRadius: 999,
          border: isFollowed ? "1px solid var(--rule)" : "none",
          background: isFollowed ? "transparent" : "var(--ink)",
          color: isFollowed ? "var(--inkMuted)" : "var(--paper)",
          fontFamily: "var(--mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
          transition: "opacity 0.15s"
        }}
      >
        {isFollowed ? "Following" : "Follow"}
      </button>
    </div>
  );
}
