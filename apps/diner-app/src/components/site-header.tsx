"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--rule)",
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--display)",
            fontWeight: 400 as CSSProperties["fontWeight"],
            fontSize: 20,
            letterSpacing: -0.3,
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          the<span style={{ color: "var(--accent)", fontStyle: "italic" }}>Menu</span>
        </Link>

        {!loading && (
          <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user ? (
              <>
                <Link
                  href="/profile"
                  style={{
                    fontFamily: "var(--ui)",
                    fontSize: 13,
                    color: "var(--inkMuted)",
                    textDecoration: "none",
                  }}
                >
                  {user.displayName ?? user.email}
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    all: "unset" as CSSProperties["all"],
                    cursor: "pointer",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--inkFaint)",
                    padding: "4px 10px",
                    border: "1px solid var(--rule)",
                    borderRadius: 999,
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={{
                    fontFamily: "var(--ui)",
                    fontSize: 13,
                    color: "var(--inkMuted)",
                    textDecoration: "none",
                  }}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    background: "var(--ink)",
                    color: "var(--paper)",
                    borderRadius: 999,
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    textDecoration: "none",
                  }}
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
