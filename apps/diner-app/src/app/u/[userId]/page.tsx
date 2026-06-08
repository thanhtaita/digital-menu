import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { UserProfileHeader } from "@/components/social/UserProfileHeader";
import { PostGrid } from "@/components/social/PostGrid";
import { FollowButtonIsland } from "./follow-button-island";
import { fetchUserProfile, fetchUserPosts } from "@/lib/social";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const id = parseInt(userId, 10);
  if (isNaN(id)) return { title: "Profile" };
  const profile = await fetchUserProfile(id);
  if (!profile) return { title: "Profile" };
  return { title: `${profile.displayName ?? `User ${profile.id}`} · theMenu` };
}

export default async function UserProfilePage({ params }: Props) {
  const { userId } = await params;
  const id = parseInt(userId, 10);
  if (isNaN(id)) notFound();

  const [profile, postsRes] = await Promise.all([fetchUserProfile(id), fetchUserPosts(id)]);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[640px] px-6">
        <UserProfileHeader
          profile={profile}
          followSlot={
            <FollowButtonIsland
              userId={profile.id}
              initialIsFollowed={profile.isFollowedByMe}
              initialFollowerCount={profile.followerCount}
            />
          }
        />

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 24 }}>
          <PostGrid posts={postsRes.posts} showRestaurant />
        </div>
      </main>
    </div>
  );
}
