import type { ReactNode } from "react";
import type { UserPublicProfile } from "@digital-menu/shared";
import { AvatarOrGradient } from "./AvatarOrGradient";

interface UserProfileHeaderProps {
  profile: UserPublicProfile;
  followSlot?: ReactNode;
}

export function UserProfileHeader({ profile, followSlot }: UserProfileHeaderProps) {
  const name = profile.displayName ?? `User ${profile.id}`;

  return (
    <div style={{ padding: "32px 0 24px" }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <AvatarOrGradient avatarUrl={profile.avatarUrl} seed={name} size={72} />

        <div style={{ flex: 1, minWidth: 0 }}>
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
            {name}
          </h1>

          {profile.bio && (
            <p
              style={{
                fontFamily: "var(--ui)",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--inkMuted)",
                margin: "0 0 12px",
                maxWidth: 480
              }}
            >
              {profile.bio}
            </p>
          )}

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--ink)" }}>
                <strong>{profile.postCount}</strong>{" "}
                <span style={{ color: "var(--inkMuted)" }}>posts</span>
              </span>
              <span style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--ink)" }}>
                <strong>{profile.followingCount}</strong>{" "}
                <span style={{ color: "var(--inkMuted)" }}>following</span>
              </span>
            </div>
            {followSlot}
          </div>
        </div>
      </div>
    </div>
  );
}
