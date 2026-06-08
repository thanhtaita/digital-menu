"use client";

import { useAuth } from "@/lib/auth-context";
import { FollowButton } from "@/components/social/FollowButton";

interface Props {
  userId: number;
  initialIsFollowed: boolean;
  initialFollowerCount: number;
}

export function FollowButtonIsland({ userId, initialIsFollowed, initialFollowerCount }: Props) {
  const { user } = useAuth();
  if (!user || user.id === userId) return null;

  return (
    <FollowButton
      userId={userId}
      initialIsFollowed={initialIsFollowed}
      initialFollowerCount={initialFollowerCount}
    />
  );
}
