"use client";

import { useState } from "react";
import type { PostMediaItem } from "@digital-menu/shared";

interface PostMediaCarouselProps {
  media: PostMediaItem[];
}

export function PostMediaCarousel({ media }: PostMediaCarouselProps) {
  const [current, setCurrent] = useState(0);
  if (media.length === 0) return null;

  const item = media[current];

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "var(--rule)" }}>
      {item.kind === "image" ? (
        <img
          src={item.url}
          alt=""
          style={{ width: "100%", maxHeight: 480, objectFit: "contain", display: "block" }}
        />
      ) : (
        <video
          src={item.url}
          controls
          style={{ width: "100%", maxHeight: 480, display: "block" }}
        />
      )}

      {media.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              all: "unset",
              cursor: current === 0 ? "default" : "pointer",
              background: "rgba(0,0,0,0.4)",
              color: "#fff",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              opacity: current === 0 ? 0.3 : 1
            }}
          >
            ‹
          </button>
          <button
            onClick={() => setCurrent((c) => Math.min(media.length - 1, c + 1))}
            disabled={current === media.length - 1}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              all: "unset",
              cursor: current === media.length - 1 ? "default" : "pointer",
              background: "rgba(0,0,0,0.4)",
              color: "#fff",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              opacity: current === media.length - 1 ? 0.3 : 1
            }}
          >
            ›
          </button>
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 5
            }}
          >
            {media.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === current ? "#fff" : "rgba(255,255,255,0.4)",
                  cursor: "pointer"
                }}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
