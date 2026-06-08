"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { CommentResponse } from "@digital-menu/shared";
import { apiGetComments, apiCreateComment, apiDeleteComment } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { AvatarOrGradient } from "./AvatarOrGradient";

interface CommentSectionProps {
  postId: number;
}

function CommentItem({
  comment,
  postId,
  onDelete
}: {
  comment: CommentResponse;
  postId: number;
  onDelete: (id: number) => void;
}) {
  const { user } = useAuth();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replies, setReplies] = useState(comment.replies);

  const authorName = comment.author.displayName ?? `User ${comment.author.id}`;

  async function submitReply() {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newReply = await apiCreateComment(postId, {
        content: replyText.trim(),
        parentCommentId: comment.id
      });
      setReplies((prev) => [...prev, newReply]);
      setReplyText("");
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Link href={`/u/${comment.author.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
          <AvatarOrGradient avatarUrl={comment.author.avatarUrl} seed={authorName} size={28} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <Link
              href={`/u/${comment.author.id}`}
              style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}
            >
              {authorName}
            </Link>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--inkFaint)" }}>
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
            {user?.id === comment.author.id && (
              <button
                onClick={() => onDelete(comment.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  color: "var(--inkFaint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                Delete
              </button>
            )}
          </div>
          <p style={{ fontFamily: "var(--ui)", fontSize: 13, lineHeight: 1.5, color: "var(--ink)", margin: "3px 0 0" }}>
            {comment.content}
          </p>
          {user && (
            <button
              onClick={() => setReplyOpen((o) => !o)}
              style={{
                all: "unset",
                cursor: "pointer",
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--inkFaint)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 4
              }}
            >
              Reply
            </button>
          )}

          {replyOpen && (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                maxLength={1000}
                style={{
                  flex: 1,
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontFamily: "var(--ui)",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: "var(--paper)",
                  outline: "none"
                }}
              />
              <button
                onClick={submitReply}
                disabled={!replyText.trim() || submitting}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  opacity: submitting ? 0.5 : 1
                }}
              >
                {submitting ? "…" : "Send"}
              </button>
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div style={{ marginLeft: 38, marginTop: 8, borderLeft: "2px solid var(--rule)", paddingLeft: 12 }}>
          {replies.map((reply) => (
            <div key={reply.id} style={{ paddingBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AvatarOrGradient
                  avatarUrl={reply.author.avatarUrl}
                  seed={reply.author.displayName ?? `User ${reply.author.id}`}
                  size={22}
                />
                <div>
                  <span style={{ fontFamily: "var(--ui)", fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>
                    {reply.author.displayName ?? `User ${reply.author.id}`}
                  </span>
                  <p style={{ fontFamily: "var(--ui)", fontSize: 13, lineHeight: 1.5, color: "var(--ink)", margin: "2px 0 0" }}>
                    {reply.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGetComments(postId)
      .then((res) => setComments(res.comments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  async function submit() {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const comment = await apiCreateComment(postId, { content: newComment.trim() });
      setComments((prev) => [comment, ...prev]);
      setNewComment("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await apiDeleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {}
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--inkFaint)",
          margin: "0 0 16px"
        }}
      >
        Comments
      </h2>

      {user && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <AvatarOrGradient
            avatarUrl={user.avatarUrl}
            seed={user.displayName ?? user.email}
            size={32}
          />
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
              placeholder="Add a comment…"
              maxLength={1000}
              style={{
                flex: 1,
                border: "1px solid var(--rule)",
                borderRadius: 6,
                padding: "8px 12px",
                fontFamily: "var(--ui)",
                fontSize: 13,
                color: "var(--ink)",
                background: "var(--paper)",
                outline: "none"
              }}
            />
            <button
              onClick={submit}
              disabled={!newComment.trim() || submitting}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                cursor: "pointer",
                opacity: submitting ? 0.5 : 1
              }}
            >
              Post
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--inkFaint)" }}>Loading…</p>
      ) : comments.length === 0 ? (
        <p style={{ fontFamily: "var(--ui)", fontSize: 13, color: "var(--inkFaint)" }}>
          No comments yet.{user ? " Be the first!" : ""}
        </p>
      ) : (
        comments.map((c) => (
          <CommentItem key={c.id} comment={c} postId={postId} onDelete={handleDelete} />
        ))
      )}
    </section>
  );
}
