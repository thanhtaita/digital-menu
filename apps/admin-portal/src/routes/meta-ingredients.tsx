import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  apiApproveIngredient,
  apiCreateIngredient,
  apiListPendingIngredients,
  apiRejectIngredient
} from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export function MetaIngredientsPage() {
  const queryClient = useQueryClient();
  const [canonicalName, setCanonicalName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isCommonAllergen, setIsCommonAllergen] = useState(false);
  const [commonAllergenGroup, setCommonAllergenGroup] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const pendingQ = useQuery({
    queryKey: ["ingredients-pending"],
    queryFn: apiListPendingIngredients
  });

  const approveM = useMutation({
    mutationFn: (id: number) => apiApproveIngredient(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-pending"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    }
  });

  const rejectM = useMutation({
    mutationFn: (id: number) => apiRejectIngredient(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-pending"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    }
  });

  const createM = useMutation({
    mutationFn: () =>
      apiCreateIngredient({
        canonicalName,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        isCommonAllergen,
        ...(commonAllergenGroup.trim() ? { commonAllergenGroup: commonAllergenGroup.trim() } : {})
      }),
    onSuccess: () => {
      setFormError(null);
      setCanonicalName("");
      setSlug("");
      setDescription("");
      setIsCommonAllergen(false);
      setCommonAllergenGroup("");
      void queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; data?: { error?: string; code?: string } };
      if (e?.status === 409) {
        setFormError("That canonical name is already in the dictionary.");
        return;
      }
      if (e?.status === 403) {
        setFormError("You do not have permission to add ingredients.");
        return;
      }
      setFormError(e?.data?.error ?? "Could not create ingredient.");
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ingredient catalog (meta owner)</h1>
        <p className="text-sm text-muted-foreground">
          Approve requests from restaurant owners, or add ingredients directly to the official dictionary. Restaurant
          requests stay hidden from other venues until you approve them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending requests</CardTitle>
          <CardDescription>Ingredients submitted by restaurant admins awaiting approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {pendingQ.error && (
            <p className="text-sm text-red-600">Could not load pending list. Is the API running?</p>
          )}
          {pendingQ.data && pendingQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending ingredients.</p>
          )}
          {pendingQ.data && pendingQ.data.length > 0 && (
            <ul className="space-y-2">
              {pendingQ.data.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{row.canonicalName}</span>
                    {row.restaurantName != null && row.restaurantName !== "" && (
                      <span className="text-muted-foreground"> — {row.restaurantName}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={approveM.isPending || rejectM.isPending}
                      onClick={() => approveM.mutate(row.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-700"
                      disabled={approveM.isPending || rejectM.isPending}
                      onClick={() => {
                        if (window.confirm(`Reject “${row.canonicalName}”? This cannot be undone.`)) {
                          rejectM.mutate(row.id);
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add ingredient (official)</CardTitle>
          <CardDescription>
            Creates an approved dictionary entry immediately. Canonical name is required. Slug is optional (generated from
            the name if omitted: lowercase, hyphens).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="max-w-md space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              setFormError(null);
              createM.mutate();
            }}
          >
            <div className="space-y-2">
              <label htmlFor="canonicalName" className="text-sm font-medium">
                Canonical name
              </label>
              <Input
                id="canonicalName"
                value={canonicalName}
                onChange={(e) => setCanonicalName(e.target.value)}
                placeholder="e.g. Sumac"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="slug" className="text-sm font-medium">
                Slug (optional)
              </label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="sumac — lowercase, numbers, hyphens only"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (optional)
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short note for diners"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isCommonAllergen}
                  onChange={(e) => setIsCommonAllergen(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Common allergen
              </label>
            </div>
            {isCommonAllergen && (
              <div className="space-y-2">
                <label htmlFor="allergenGroup" className="text-sm font-medium">
                  Allergen group (optional)
                </label>
                <Input
                  id="allergenGroup"
                  value={commonAllergenGroup}
                  onChange={(e) => setCommonAllergenGroup(e.target.value)}
                  placeholder="e.g. sesame"
                  autoComplete="off"
                />
              </div>
            )}
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Button type="submit" disabled={createM.isPending || !canonicalName.trim()}>
              {createM.isPending ? "Saving…" : "Add to dictionary"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
