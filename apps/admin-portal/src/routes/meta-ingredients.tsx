import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../components/confirm-dialog";
import { FdcCandidateDetailDialog } from "../components/fdc-candidate-detail-dialog";
import {
  apiAcceptFdcCandidate,
  apiApproveIngredient,
  apiCreateIngredient,
  apiDeleteIngredient,
  apiListIngredientTranslations,
  apiUpsertIngredientTranslation,
  apiDeleteIngredientTranslation,
  apiListFdcCandidates,
  apiListPendingIngredients,
  apiRejectFdcCandidate,
  apiRejectIngredient,
  apiUpdateIngredient,
  apiUploadIngredientMedia,
  apiDeleteIngredientMedia,
  apiReorderIngredientMedia,
  apiListIngredients,
  apiSearchIngredients,
  type Ingredient,
  type TranslationRow
} from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { GALLERY_MEDIA_ACCEPT, GALLERY_MULTI_FILE_HINT } from "@/lib/upload-ui";
import { fdcDataTypeLabel, resolveUploadAssetUrl } from "../lib/fdc-labels";

export function MetaIngredientsPage() {
  const queryClient = useQueryClient();
  const [canonicalName, setCanonicalName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isCommonAllergen, setIsCommonAllergen] = useState(false);
  const [commonAllergenGroup, setCommonAllergenGroup] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [createdIngredient, setCreatedIngredient] = useState<Ingredient | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [detailCandidateId, setDetailCandidateId] = useState<number | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [editingIngredientId, setEditingIngredientId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsAllergen, setEditIsAllergen] = useState(false);
  const [editAllergenGroup, setEditAllergenGroup] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Browse (no-query) state
  const PAGE_SIZE = 20;
  const [browseList, setBrowseList] = useState<Ingredient[]>([]);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [browseHasMore, setBrowseHasMore] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Ingredient media editing state
  const [mediaIngredientId, setMediaIngredientId] = useState<number | null>(null);

  // Ingredient translation state
  const [translatingIngredientId, setTranslatingIngredientId] = useState<number | null>(null);
  const [ingredientTranslations, setIngredientTranslations] = useState<TranslationRow[]>([]);
  const [ingTranslationLocale, setIngTranslationLocale] = useState("");
  const [ingTranslationName, setIngTranslationName] = useState("");
  const [ingTranslationDescription, setIngTranslationDescription] = useState("");
  const [ingTranslationError, setIngTranslationError] = useState<string | null>(null);
  const [ingTranslationLoading, setIngTranslationLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function loadMoreBrowse(startOffset: number) {
    setBrowseLoading(true);
    try {
      const items = await apiListIngredients(startOffset, PAGE_SIZE);
      setBrowseList((prev) => (startOffset === 0 ? items : [...prev, ...items]));
      setBrowseHasMore(items.length === PAGE_SIZE);
      setBrowseOffset(startOffset + items.length);
    } finally {
      setBrowseLoading(false);
    }
  }

  useEffect(() => {
    void loadMoreBrowse(0);
  }, []);

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      void loadMoreBrowse(0);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const first = photoFiles[0];
    if (!first) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(first);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFiles]);

  const createdIngredientMediaSorted = [...(createdIngredient?.media ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id - b.id
  );

  async function refreshCreatedIngredient(id: number, nameHint: string): Promise<Ingredient | null> {
    const list = await apiSearchIngredients(nameHint);
    return list.find((i) => i.id === id) ?? null;
  }

  const pendingQ = useQuery({
    queryKey: ["ingredients-pending"],
    queryFn: apiListPendingIngredients
  });

  const fdcCandidatesQ = useQuery({
    queryKey: ["ingredients-fdc-candidates"],
    queryFn: apiListFdcCandidates
  });

  const acceptFdcCandidateM = useMutation({
    mutationFn: (id: number) => apiAcceptFdcCandidate(id),
    onSuccess: async () => {
      setDetailCandidateId(null);
      await queryClient.invalidateQueries({ queryKey: ["ingredients-fdc-candidates"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search-meta"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    }
  });

  const rejectFdcCandidateM = useMutation({
    mutationFn: (id: number) => apiRejectFdcCandidate(id),
    onSuccess: async () => {
      setDetailCandidateId(null);
      await queryClient.invalidateQueries({ queryKey: ["ingredients-fdc-candidates"] });
    }
  });

  const searchQ = useQuery({
    queryKey: ["ingredients-search-meta", debouncedQuery],
    queryFn: () => apiSearchIngredients(debouncedQuery),
    enabled: debouncedQuery.length >= 1
  });

  const updateIngredientM = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Parameters<typeof apiUpdateIngredient>[1] }) =>
      apiUpdateIngredient(id, input),
    onSuccess: async () => {
      setEditingIngredientId(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search-meta"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-pending"] });
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; data?: { error?: string } };
      if (e?.status === 409) {
        setEditError("That name is already taken.");
        return;
      }
      setEditError(e?.data?.error ?? "Update failed.");
    }
  });

  const deleteIngredientM = useMutation({
    mutationFn: (id: number) => apiDeleteIngredient(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search-meta"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
      await queryClient.invalidateQueries({ queryKey: ["ingredients-pending"] });
    }
  });

  async function loadIngredientTranslations(id: number) {
    setIngTranslationLoading(true);
    try {
      const rows = await apiListIngredientTranslations(id);
      setIngredientTranslations(rows);
    } finally {
      setIngTranslationLoading(false);
    }
  }

  const upsertIngredientTranslationM = useMutation({
    mutationFn: (input: { ingredientId: number; locale: string; name: string; description?: string | null }) =>
      apiUpsertIngredientTranslation(input.ingredientId, {
        locale: input.locale,
        name: input.name,
        description: input.description
      }),
    onSuccess: async (_, vars) => {
      setIngTranslationLocale("");
      setIngTranslationName("");
      setIngTranslationDescription("");
      setIngTranslationError(null);
      await loadIngredientTranslations(vars.ingredientId);
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; data?: { error?: string } };
      setIngTranslationError(e?.data?.error ?? "Failed to save translation.");
    }
  });

  const deleteIngredientTranslationM = useMutation({
    mutationFn: ({ ingredientId, locale }: { ingredientId: number; locale: string }) =>
      apiDeleteIngredientTranslation(ingredientId, locale),
    onSuccess: async (_, vars) => {
      await loadIngredientTranslations(vars.ingredientId);
    }
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

  const uploadCreatedIngredientMediaM = useMutation({
    mutationFn: async (files: File[]) => {
      if (!createdIngredient) throw new Error("No ingredient created yet");
      for (const f of files) {
        await apiUploadIngredientMedia(createdIngredient.id, f);
      }
      const refreshed = await refreshCreatedIngredient(createdIngredient.id, createdIngredient.canonicalName);
      if (refreshed) setCreatedIngredient(refreshed);
    }
  });

  const deleteCreatedIngredientMediaM = useMutation({
    mutationFn: async (mediaId: number) => {
      if (!createdIngredient) throw new Error("No ingredient created yet");
      await apiDeleteIngredientMedia(createdIngredient.id, mediaId);
      const refreshed = await refreshCreatedIngredient(createdIngredient.id, createdIngredient.canonicalName);
      if (refreshed) setCreatedIngredient(refreshed);
    }
  });

  const reorderCreatedIngredientMediaM = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      if (!createdIngredient) throw new Error("No ingredient created yet");
      await apiReorderIngredientMedia(createdIngredient.id, orderedIds);
      const refreshed = await refreshCreatedIngredient(createdIngredient.id, createdIngredient.canonicalName);
      if (refreshed) setCreatedIngredient(refreshed);
    }
  });

  const uploadSearchIngredientMediaM = useMutation({
    mutationFn: async ({ ingredientId, files }: { ingredientId: number; files: File[] }) => {
      for (const f of files) {
        await apiUploadIngredientMedia(ingredientId, f);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search-meta"] });
    }
  });

  const deleteSearchIngredientMediaM = useMutation({
    mutationFn: ({ ingredientId, mediaId }: { ingredientId: number; mediaId: number }) =>
      apiDeleteIngredientMedia(ingredientId, mediaId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search-meta"] });
    }
  });

  const reorderSearchIngredientMediaM = useMutation({
    mutationFn: ({ ingredientId, orderedIds }: { ingredientId: number; orderedIds: number[] }) =>
      apiReorderIngredientMedia(ingredientId, orderedIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search-meta"] });
    }
  });

  const searchMediaBusy =
    uploadSearchIngredientMediaM.isPending ||
    deleteSearchIngredientMediaM.isPending ||
    reorderSearchIngredientMediaM.isPending;

  const createM = useMutation({
    mutationFn: async () => {
      const created = await apiCreateIngredient({
        canonicalName: canonicalName.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        isCommonAllergen,
        ...(commonAllergenGroup.trim() ? { commonAllergenGroup: commonAllergenGroup.trim() } : {})
      });
      for (const f of photoFiles) {
        await apiUploadIngredientMedia(created.id, f);
      }
      return (await refreshCreatedIngredient(created.id, created.canonicalName)) ?? created;
    },
    onSuccess: (ing) => {
      setFormError(null);
      setCanonicalName("");
      setSlug("");
      setDescription("");
      setIsCommonAllergen(false);
      setCommonAllergenGroup("");
      setPhotoFiles([]);
      setCreatedIngredient(ing);
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

  const createdGalleryBusy =
    createM.isPending ||
    uploadCreatedIngredientMediaM.isPending ||
    deleteCreatedIngredientMediaM.isPending ||
    reorderCreatedIngredientMediaM.isPending;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmDialog != null}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        destructive={confirmDialog?.destructive ?? false}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
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
                      onClick={() =>
                        setConfirmDialog({
                          title: "Reject ingredient",
                          message: `Reject "${row.canonicalName}"? This cannot be undone.`,
                          confirmLabel: "Reject",
                          destructive: true,
                          onConfirm: () => rejectM.mutate(row.id)
                        })
                      }
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
          <CardTitle className="text-base">FDC nutrition matches</CardTitle>
          <CardDescription>
            Candidate USDA FoodData Central matches found by the nutrition backfill job. Accepting copies
            nutrients into the ingredient; rejecting just dismisses the suggestion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fdcCandidatesQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {fdcCandidatesQ.error && (
            <p className="text-sm text-red-600">Could not load FDC match candidates. Is the API running?</p>
          )}
          {fdcCandidatesQ.data && fdcCandidatesQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending FDC matches to review.</p>
          )}
          {fdcCandidatesQ.data && fdcCandidatesQ.data.length > 0 && (
            <ul className="space-y-2">
              {fdcCandidatesQ.data.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  onClick={() => setDetailCandidateId(row.id)}
                >
                  <div className="min-w-0">
                    <span className="font-medium">{row.ingredientCanonicalName}</span>
                    <span className="text-muted-foreground"> → {row.fdcDescription}</span>
                    {row.fdcDataType && (
                      <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        {fdcDataTypeLabel(row.fdcDataType)}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-slate-400">score {row.score.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={acceptFdcCandidateM.isPending || rejectFdcCandidateM.isPending}
                      onClick={() => acceptFdcCandidateM.mutate(row.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-700"
                      disabled={acceptFdcCandidateM.isPending || rejectFdcCandidateM.isPending}
                      onClick={() =>
                        setConfirmDialog({
                          title: "Reject FDC match",
                          message: `Dismiss "${row.fdcDescription}" as a match for "${row.ingredientCanonicalName}"?`,
                          confirmLabel: "Reject",
                          destructive: true,
                          onConfirm: () => rejectFdcCandidateM.mutate(row.id)
                        })
                      }
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

      <FdcCandidateDetailDialog
        candidateId={detailCandidateId}
        onClose={() => setDetailCandidateId(null)}
        onAccept={(id) => acceptFdcCandidateM.mutate(id)}
        onReject={(id) => rejectFdcCandidateM.mutate(id)}
        isMutating={acceptFdcCandidateM.isPending || rejectFdcCandidateM.isPending}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search ingredients</CardTitle>
          <CardDescription>Search by name to edit or delete any ingredient in the dictionary.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a name to search (e.g. garlic)..."
            autoComplete="off"
            className="max-w-sm"
          />
          {(searchQ.isFetching || (browseLoading && browseList.length === 0)) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {debouncedQuery.length >= 1 ? "Searching…" : "Loading…"}
            </p>
          )}
          {(debouncedQuery.length === 0 || (searchQ.isFetched && !searchQ.isFetching)) && (
            <div className="mt-3 max-h-[520px] overflow-y-auto pr-1">
              <div className="space-y-2">
                {(() => {
                  const displayList = debouncedQuery.length === 0 ? browseList : (searchQ.data ?? []);
                  if (displayList.length === 0 && !browseLoading) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        {debouncedQuery.length >= 1
                          ? `No ingredients found for "${debouncedQuery}".`
                          : "No ingredients found."}
                      </p>
                    );
                  }
                  return displayList.map((ing) => (
                  <div key={ing.id} className="rounded border border-slate-200 bg-white p-3 text-sm">
                    {editingIngredientId === ing.id ? (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!editName.trim()) return;
                          updateIngredientM.mutate({
                            id: ing.id,
                            input: {
                              canonicalName: editName.trim(),
                              description: editDescription.trim() || null,
                              isCommonAllergen: editIsAllergen,
                              commonAllergenGroup: editIsAllergen ? editAllergenGroup.trim() || null : null
                            }
                          });
                        }}
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Name</label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              required
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Description</label>
                            <Input
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={editIsAllergen}
                            onChange={(e) => setEditIsAllergen(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Common allergen
                        </label>
                        {editIsAllergen && (
                          <div>
                            <label className="mb-0.5 block text-xs text-slate-500">Allergen group</label>
                            <Input
                              value={editAllergenGroup}
                              onChange={(e) => setEditAllergenGroup(e.target.value)}
                              placeholder="e.g. sesame"
                            />
                          </div>
                        )}
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={updateIngredientM.isPending}>
                            {updateIngredientM.isPending ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingIngredientId(null); setEditError(null); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{ing.canonicalName}</p>
                            {ing.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{ing.description}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>slug: {ing.slug}</span>
                              {ing.isCommonAllergen && (
                                <span className="text-amber-700">
                                  allergen{ing.commonAllergenGroup ? `: ${ing.commonAllergenGroup}` : ""}
                                </span>
                              )}
                              <span className={ing.approvalStatus === "approved" ? "text-emerald-700" : "text-amber-700"}>
                                {ing.approvalStatus}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingIngredientId(ing.id);
                                setEditName(ing.canonicalName);
                                setEditDescription(ing.description ?? "");
                                setEditIsAllergen(ing.isCommonAllergen);
                                setEditAllergenGroup(ing.commonAllergenGroup ?? "");
                                setEditError(null);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setMediaIngredientId(mediaIngredientId === ing.id ? null : ing.id)
                              }
                            >
                              {mediaIngredientId === ing.id ? "Close media" : "Media"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (translatingIngredientId === ing.id) {
                                  setTranslatingIngredientId(null);
                                } else {
                                  setTranslatingIngredientId(ing.id);
                                  setIngTranslationLocale("");
                                  setIngTranslationName("");
                                  setIngTranslationDescription("");
                                  setIngTranslationError(null);
                                  await loadIngredientTranslations(ing.id);
                                }
                              }}
                            >
                              Translations
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-700"
                              disabled={deleteIngredientM.isPending}
                              onClick={() =>
                                setConfirmDialog({
                                  title: "Delete ingredient",
                                  message: `Delete "${ing.canonicalName}"? This cannot be undone. The ingredient must not be in use by any dishes.`,
                                  confirmLabel: "Delete",
                                  destructive: true,
                                  onConfirm: () => deleteIngredientM.mutate(ing.id)
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        {mediaIngredientId === ing.id && (() => {
                          const mediaSorted = [...(ing.media ?? [])].sort(
                            (a, b) => a.displayOrder - b.displayOrder || a.id - b.id
                          );
                          return (
                            <div className="border-t border-slate-100 pt-3 space-y-2">
                              <p className="text-xs font-medium text-slate-800">Media gallery</p>
                              {mediaSorted.length > 0 ? (
                                <ul className="space-y-2">
                                  {mediaSorted.map((m, index) => (
                                    <li
                                      key={m.id}
                                      className="flex flex-wrap items-start gap-2 rounded border border-slate-100 bg-slate-50/80 p-2"
                                    >
                                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-slate-200">
                                        {m.kind === "image" ? (
                                          <img
                                            src={resolveUploadAssetUrl(m.url)}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <video
                                            src={resolveUploadAssetUrl(m.url)}
                                            className="h-full w-full object-cover"
                                            controls
                                            muted
                                            playsInline
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-medium capitalize text-slate-800">{m.kind}</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[11px]"
                                            disabled={index === 0 || searchMediaBusy}
                                            onClick={() => {
                                              const next = [...mediaSorted];
                                              [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                                              reorderSearchIngredientMediaM.mutate({
                                                ingredientId: ing.id,
                                                orderedIds: next.map((x) => x.id)
                                              });
                                            }}
                                          >
                                            Up
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[11px]"
                                            disabled={index >= mediaSorted.length - 1 || searchMediaBusy}
                                            onClick={() => {
                                              const next = [...mediaSorted];
                                              [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                                              reorderSearchIngredientMediaM.mutate({
                                                ingredientId: ing.id,
                                                orderedIds: next.map((x) => x.id)
                                              });
                                            }}
                                          >
                                            Down
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-6 border-red-200 text-[11px] text-red-700 hover:bg-red-50"
                                            disabled={searchMediaBusy}
                                            onClick={() =>
                                              setConfirmDialog({
                                                title: "Remove media",
                                                message: `Remove this ${m.kind} from the ingredient gallery?`,
                                                confirmLabel: "Remove",
                                                destructive: true,
                                                onConfirm: () =>
                                                  deleteSearchIngredientMediaM.mutate({
                                                    ingredientId: ing.id,
                                                    mediaId: m.id
                                                  })
                                              })
                                            }
                                          >
                                            Remove
                                          </Button>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-muted-foreground">No photos or videos yet.</p>
                              )}
                              <input
                                type="file"
                                multiple
                                accept={GALLERY_MEDIA_ACCEPT}
                                className="max-w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1"
                                disabled={searchMediaBusy}
                                onChange={(e) => {
                                  const files = Array.from(e.target.files ?? []);
                                  if (files.length > 0)
                                    uploadSearchIngredientMediaM.mutate({ ingredientId: ing.id, files });
                                  e.target.value = "";
                                }}
                              />
                              {searchMediaBusy && (
                                <p className="text-xs text-muted-foreground">Updating…</p>
                              )}
                            </div>
                          );
                        })()}

                        {translatingIngredientId === ing.id && (
                          <div className="border-t border-slate-100 pt-3 space-y-3">
                            <p className="text-xs font-medium text-slate-800">Translations</p>
                            {ingTranslationLoading ? (
                              <p className="text-xs text-muted-foreground">Loading…</p>
                            ) : (
                              <>
                                {ingredientTranslations.length > 0 && (
                                  <ul className="space-y-1">
                                    {ingredientTranslations.map((t) => (
                                      <li
                                        key={t.locale}
                                        className="flex flex-wrap items-start justify-between gap-1 rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs"
                                      >
                                        <div className="min-w-0">
                                          <span className="mr-1.5 rounded bg-slate-200 px-1 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                                            {t.locale}
                                          </span>
                                          <span className="font-medium text-slate-900">{t.name}</span>
                                          {t.description && (
                                            <p className="mt-0.5 text-[11px] text-slate-500">{t.description}</p>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmDialog({
                                              title: "Delete translation",
                                              message: `Remove the "${t.locale}" translation for "${ing.canonicalName}"?`,
                                              confirmLabel: "Delete",
                                              destructive: true,
                                              onConfirm: () =>
                                                deleteIngredientTranslationM.mutate({
                                                  ingredientId: ing.id,
                                                  locale: t.locale
                                                })
                                            })
                                          }
                                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                                          disabled={deleteIngredientTranslationM.isPending}
                                        >
                                          ✕
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {ingredientTranslations.length === 0 && (
                                  <p className="text-xs text-slate-500">No translations yet.</p>
                                )}
                                <form
                                  className="space-y-2"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    if (!ingTranslationLocale.trim() || !ingTranslationName.trim()) return;
                                    upsertIngredientTranslationM.mutate({
                                      ingredientId: ing.id,
                                      locale: ingTranslationLocale.trim(),
                                      name: ingTranslationName.trim(),
                                      description: ingTranslationDescription.trim() || null
                                    });
                                  }}
                                >
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <div>
                                      <label className="mb-0.5 block text-[11px] text-slate-500">Locale</label>
                                      <Input
                                        value={ingTranslationLocale}
                                        onChange={(e) => setIngTranslationLocale(e.target.value)}
                                        placeholder="fr"
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-0.5 block text-[11px] text-slate-500">Name</label>
                                      <Input
                                        value={ingTranslationName}
                                        onChange={(e) => setIngTranslationName(e.target.value)}
                                        placeholder="Translated name"
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-0.5 block text-[11px] text-slate-500">Description</label>
                                      <Input
                                        value={ingTranslationDescription}
                                        onChange={(e) => setIngTranslationDescription(e.target.value)}
                                        placeholder="Optional"
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                  </div>
                                  {ingTranslationError && (
                                    <p className="text-xs text-red-600">{ingTranslationError}</p>
                                  )}
                                  <Button
                                    type="submit"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={
                                      upsertIngredientTranslationM.isPending ||
                                      !ingTranslationLocale.trim() ||
                                      !ingTranslationName.trim()
                                    }
                                  >
                                    {upsertIngredientTranslationM.isPending ? "Saving…" : "Save translation"}
                                  </Button>
                                </form>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  ));
                })()}
              </div>
              {debouncedQuery.length === 0 && browseHasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => void loadMoreBrowse(browseOffset)}
                  disabled={browseLoading}
                >
                  {browseLoading ? "Loading…" : "Load more"}
                </Button>
              )}
            </div>
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
            <div className="space-y-2">
              <label htmlFor="ingredientPhoto" className="text-sm font-medium">
                Photos / videos (optional)
              </label>
              <p className="text-xs text-muted-foreground">
                Stored under the API <code className="rounded bg-slate-100 px-1">uploads/</code> until you move to cloud
                storage. {GALLERY_MULTI_FILE_HINT} Reorder under Menu builder → ingredient search after the entry exists.
              </p>
              <input
                id="ingredientPhoto"
                type="file"
                multiple
                accept={GALLERY_MEDIA_ACCEPT}
                className="max-w-xs text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1"
                disabled={createM.isPending}
                onChange={(e) => {
                  setPhotoFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              {photoFiles.length > 0 ? (
                <p className="text-xs text-muted-foreground">{photoFiles.length} file(s) selected.</p>
              ) : null}
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt=""
                  className="mt-2 h-24 w-24 rounded-md border object-cover"
                />
              ) : null}
            </div>
            {createdIngredient ? (
              <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
                <p className="text-sm font-medium">Media gallery</p>
                <p className="text-xs text-muted-foreground">
                  For: <span className="font-medium text-slate-800">{createdIngredient.canonicalName}</span>.{" "}
                  {GALLERY_MULTI_FILE_HINT}
                </p>
                {createdIngredientMediaSorted.length > 0 ? (
                  <ul className="space-y-2">
                    {createdIngredientMediaSorted.map((m, index) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-start gap-2 rounded border border-slate-100 bg-slate-50/80 p-2"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-slate-200">
                          {m.kind === "image" ? (
                            <img
                              src={resolveUploadAssetUrl(m.url)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video
                              src={resolveUploadAssetUrl(m.url)}
                              className="h-full w-full object-cover"
                              controls
                              muted
                              playsInline
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium capitalize text-slate-800">{m.kind}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              disabled={index === 0 || createdGalleryBusy}
                              onClick={() => {
                                const next = [...createdIngredientMediaSorted];
                                [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                                reorderCreatedIngredientMediaM.mutate(next.map((x) => x.id));
                              }}
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              disabled={index >= createdIngredientMediaSorted.length - 1 || createdGalleryBusy}
                              onClick={() => {
                                const next = [...createdIngredientMediaSorted];
                                [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                                reorderCreatedIngredientMediaM.mutate(next.map((x) => x.id));
                              }}
                            >
                              Down
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 border-red-200 text-[11px] text-red-700 hover:bg-red-50"
                              disabled={createdGalleryBusy}
                              onClick={() =>
                                setConfirmDialog({
                                  title: "Remove media",
                                  message: `Remove this ${m.kind} from the ingredient gallery?`,
                                  confirmLabel: "Remove",
                                  destructive: true,
                                  onConfirm: () => deleteCreatedIngredientMediaM.mutate(m.id)
                                })
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No photos or videos yet.</p>
                )}
                <input
                  type="file"
                  multiple
                  accept={GALLERY_MEDIA_ACCEPT}
                  className="max-w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1"
                  disabled={createdGalleryBusy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) uploadCreatedIngredientMediaM.mutate(files);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : null}
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
