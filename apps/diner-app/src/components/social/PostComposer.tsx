"use client";

import { useState, useRef } from "react";
import type { PostResponse } from "@digital-menu/shared";
import { apiCreatePost, apiUploadPostMedia } from "@/lib/api-client";

interface PostComposerProps {
  restaurantId?: number;
  restaurantName?: string;
  onPosted?: (post: PostResponse) => void;
}

export function PostComposer({ restaurantId, restaurantName, onPosted }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await apiCreatePost({ content: content.trim(), restaurantId: restaurantId ?? null });
      for (const file of files) {
        try {
          await apiUploadPostMedia(post.id, file);
        } catch {
          // media upload failure is non-fatal
        }
      }
      setContent("");
      setFiles([]);
      onPosted?.(post);
    } catch {
      setError("Failed to post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 10,
        padding: 16,
        background: "var(--paper)"
      }}
    >
      {restaurantName && (
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--accent)",
            margin: "0 0 10px"
          }}
        >
          Post at {restaurantName}
        </p>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What did you think?"
        rows={3}
        maxLength={2000}
        style={{
          width: "100%",
          resize: "vertical",
          border: "none",
          outline: "none",
          fontFamily: "var(--ui)",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--ink)",
          background: "transparent",
          boxSizing: "border-box"
        }}
      />

      {files.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          {files.map((f, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={URL.createObjectURL(f)}
                alt=""
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }}
              />
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  all: "unset",
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p style={{ fontFamily: "var(--ui)", fontSize: 12, color: "red", margin: "6px 0 0" }}>{error}</p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          borderTop: "1px solid var(--rule)",
          paddingTop: 12
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--inkFaint)"
          }}
        >
          + Photo
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            setFiles((prev) => [...prev, ...selected].slice(0, 5));
            e.target.value = "";
          }}
        />

        <button
          onClick={submit}
          disabled={!content.trim() || submitting}
          style={{
            padding: "6px 18px",
            borderRadius: 999,
            border: "none",
            background: content.trim() && !submitting ? "var(--ink)" : "var(--rule)",
            color: content.trim() && !submitting ? "var(--paper)" : "var(--inkFaint)",
            fontFamily: "var(--mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            cursor: content.trim() && !submitting ? "pointer" : "default",
            transition: "background 0.15s"
          }}
        >
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
