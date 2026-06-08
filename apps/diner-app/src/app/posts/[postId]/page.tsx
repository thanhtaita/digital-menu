import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PostMediaCarousel } from "@/components/social/PostMediaCarousel";
import { CommentSection } from "@/components/social/CommentSection";
import { AvatarOrGradient } from "@/components/social/AvatarOrGradient";

type Props = { params: Promise<{ postId: string }> };

async function fetchPost(postId: number) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";
  const res = await fetch(`${apiBase}/posts/${postId}`, { next: { revalidate: 30 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Post fetch failed (${res.status})`);
  const data = (await res.json()) as { post: import("@digital-menu/shared").PostResponse };
  return data.post;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const id = parseInt(postId, 10);
  if (isNaN(id)) return { title: "Post" };
  const post = await fetchPost(id);
  if (!post) return { title: "Post" };
  const name = post.author.displayName ?? `User ${post.author.id}`;
  return { title: `Post by ${name} · theMenu` };
}

export default async function PostDetailPage({ params }: Props) {
  const { postId } = await params;
  const id = parseInt(postId, 10);
  if (isNaN(id)) notFound();

  const post = await fetchPost(id);
  if (!post) notFound();

  const authorName = post.author.displayName ?? `User ${post.author.id}`;
  const dateStr = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[640px] px-6 py-8">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <Link href={`/u/${post.author.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
            <AvatarOrGradient avatarUrl={post.author.avatarUrl} seed={authorName} size={42} />
          </Link>
          <div>
            <Link
              href={`/u/${post.author.id}`}
              style={{
                fontFamily: "var(--ui)",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink)",
                textDecoration: "none",
                display: "block"
              }}
            >
              {authorName}
            </Link>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--inkFaint)" }}>{dateStr}</span>
            {post.restaurantName && post.restaurantSlug && (
              <>
                {" "}
                <Link
                  href={`/r/${post.restaurantSlug}`}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--accent)",
                    textDecoration: "none",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em"
                  }}
                >
                  @ {post.restaurantName}
                </Link>
              </>
            )}
          </div>
        </div>

        {post.media.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <PostMediaCarousel media={post.media} />
          </div>
        )}

        <p
          style={{
            fontFamily: "var(--ui)",
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--ink)",
            margin: "0 0 8px"
          }}
        >
          {post.content}
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            ♥ {post.likeCount}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--inkFaint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            ◯ {post.commentCount}
          </span>
        </div>

        <CommentSection postId={post.id} />
      </main>
    </div>
  );
}
