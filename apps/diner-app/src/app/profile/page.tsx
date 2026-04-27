"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RestrictionResponse } from "@digital-menu/shared";
import { useAuth } from "@/lib/auth-context";
import {
  apiAddRestriction,
  apiDeleteRestriction,
  apiSearchIngredients
} from "@/lib/api-client";
import { SiteHeader } from "@/components/site-header";

const DIET_LABELS: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  halal: "Halal",
  kosher: "Kosher",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_free: "Nut-free"
};

const DIET_OPTIONS = Object.entries(DIET_LABELS);

export default function ProfilePage() {
  const router = useRouter();
  const { user, restrictions, loading, refresh } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1024px] px-6 py-16">
          <div className="mx-auto max-w-xl text-stone-500">Loading…</div>
        </main>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1024px] px-6 py-12">
        <div className="mx-auto max-w-xl space-y-10">
          <section>
            <h1 className="text-2xl font-semibold text-stone-900">Profile</h1>
            <p className="mt-1 text-stone-500">{user.displayName ?? user.email}</p>
            <p className="text-sm text-stone-400">{user.email}</p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-stone-900">Dietary restrictions</h2>
            <p className="mt-1 text-sm text-stone-500">
              Dishes containing flagged ingredients will be highlighted when you browse a menu.
            </p>

            <RestrictionList restrictions={restrictions} onDelete={async (id) => {
              await apiDeleteRestriction(id);
              await refresh();
            }} />

            <AddRestrictionForm onAdded={refresh} />
          </section>
        </div>
      </main>
    </div>
  );
}

function RestrictionList({
  restrictions,
  onDelete
}: {
  restrictions: RestrictionResponse[];
  onDelete: (id: number) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);

  if (restrictions.length === 0) {
    return <p className="mt-4 text-sm text-stone-400">No restrictions added yet.</p>;
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <ul className="mt-4 space-y-2">
      {restrictions.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3"
        >
          <div>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mr-2 ${
              r.severity === "block"
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-800"
            }`}>
              {r.severity === "block" ? "Block" : "Warn"}
            </span>
            <span className="text-sm text-stone-800">
              {r.restrictionType === "diet"
                ? DIET_LABELS[r.dietType ?? ""] ?? r.dietType
                : r.ingredient?.canonicalName ?? `Ingredient #${r.ingredientId}`}
            </span>
            <span className="ml-2 text-xs text-stone-400 capitalize">{r.restrictionType}</span>
          </div>
          <button
            onClick={() => handleDelete(r.id)}
            disabled={deleting === r.id}
            className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function AddRestrictionForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const [type, setType] = useState<"allergy" | "dislike" | "diet">("allergy");
  const [severity, setSeverity] = useState<"block" | "warn">("block");
  const [dietType, setDietType] = useState("vegan");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; canonicalName: string; slug: string }[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<{ id: number; canonicalName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelectedIngredient(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const r = await apiSearchIngredients(q);
        setResults(r.slice(0, 8));
      } catch { setResults([]); }
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (type !== "diet" && !selectedIngredient) {
      setError("Select an ingredient from the list.");
      return;
    }
    setSubmitting(true);
    try {
      await apiAddRestriction({
        restrictionType: type,
        severity,
        ingredientId: type !== "diet" ? selectedIngredient!.id : undefined,
        dietType: type === "diet" ? (dietType as never) : undefined
      });
      setQuery("");
      setSelectedIngredient(null);
      setResults([]);
      await onAdded();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      setError(e.data?.error ?? "Failed to add restriction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
      <h3 className="text-sm font-medium text-stone-800">Add restriction</h3>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-xs text-stone-500">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "allergy" | "dislike" | "diet")}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="allergy">Allergy</option>
            <option value="dislike">Dislike</option>
            <option value="diet">Diet</option>
          </select>
        </div>

        {type !== "diet" && (
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs text-stone-500">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as "block" | "warn")}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="block">Block (allergy)</option>
              <option value="warn">Warn (dislike)</option>
            </select>
          </div>
        )}
      </div>

      {type === "diet" ? (
        <div>
          <label className="mb-1 block text-xs text-stone-500">Diet type</label>
          <select
            value={dietType}
            onChange={(e) => setDietType(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            {DIET_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="relative">
          <label className="mb-1 block text-xs text-stone-500">Ingredient</label>
          {selectedIngredient ? (
            <div className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
              <span className="flex-1">{selectedIngredient.canonicalName}</span>
              <button type="button" onClick={() => { setSelectedIngredient(null); setQuery(""); }} className="text-stone-400 hover:text-stone-700">✕</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Search ingredients…"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
              />
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-md">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => { setSelectedIngredient(r); setResults([]); setQuery(""); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                      >
                        {r.canonicalName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add restriction"}
      </button>
    </form>
  );
}
