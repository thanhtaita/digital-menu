"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRegister } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader } from "@/components/site-header";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiRegister({ email, password, displayName: displayName || undefined });
      await refresh();
      router.push("/");
    } catch (err) {
      const e = err as { status?: number; data?: { error?: string } };
      if (e.status === 409) {
        setError("An account with that email already exists.");
      } else {
        setError(e.data?.error ?? "Registration failed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1024px] px-6 py-16">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-semibold text-stone-900">Create account</h1>
          <p className="mt-2 text-sm text-stone-500">
            Already have an account?{" "}
            <Link href="/login" className="text-stone-900 underline">
              Log in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="display-name">
                Name <span className="text-stone-400">(optional)</span>
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
