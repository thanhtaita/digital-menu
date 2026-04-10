import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  apiAddDishIngredient,
  apiCreateDish,
  apiCreateMenu,
  apiCreateSection,
  apiListDishIngredients,
  apiListDishes,
  apiListMenus,
  apiListSections,
  apiUpdateMenu,
  apiRemoveDishIngredient,
  apiRequestIngredient,
  apiSearchIngredients,
  apiUploadDishMedia,
  apiDeleteDishMedia,
  apiReorderDishMedia,
  apiUploadIngredientMedia,
  apiDeleteIngredientMedia,
  apiReorderIngredientMedia,
  apiUpdateDish,
  apiDeleteDish,
  apiDeleteMenu,
  apiDeleteSection,
  type Dish,
  type Ingredient
} from "../lib/api-client";
import { useAuth } from "@/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { rememberRestaurantForBuilder } from "@/lib/last-restaurant";
import { GALLERY_MEDIA_ACCEPT, GALLERY_MULTI_FILE_HINT } from "@/lib/upload-ui";

const ADMIN_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3002/api/v1";

function resolveUploadAssetUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return `${new URL(ADMIN_API_BASE).origin}${url}`;
  } catch {
    return url;
  }
}

export function MenuBuilderPage() {
  const params = useParams();
  const restaurantId = Number(params.restaurantId);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (Number.isFinite(restaurantId) && restaurantId > 0) {
      rememberRestaurantForBuilder(restaurantId);
    }
  }, [restaurantId]);

  const [menuName, setMenuName] = useState("Main Menu");
  const [sectionName, setSectionName] = useState("Mains");
  const [dishName, setDishName] = useState("Sample Dish");
  const [dishPrice, setDishPrice] = useState("10.00");
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedDishId, setSelectedDishId] = useState<number | null>(null);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [requestIngredientName, setRequestIngredientName] = useState("");
  const [requestIngredientPhotos, setRequestIngredientPhotos] = useState<File[]>([]);
  const [requestIngredientError, setRequestIngredientError] = useState<string | null>(null);
  const [editingDishId, setEditingDishId] = useState<number | null>(null);
  const [editingDishDescription, setEditingDishDescription] = useState("");

  const menusQ = useQuery({
    queryKey: ["menus", restaurantId],
    queryFn: () => apiListMenus(restaurantId),
    enabled: Number.isFinite(restaurantId)
  });

  const sectionsQ = useQuery({
    queryKey: ["sections", restaurantId, selectedMenuId],
    queryFn: () => apiListSections(restaurantId, selectedMenuId!),
    enabled: selectedMenuId != null
  });

  const dishesQ = useQuery({
    queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId],
    queryFn: () => apiListDishes(restaurantId, selectedMenuId!, selectedSectionId!),
    enabled: selectedMenuId != null && selectedSectionId != null
  });

  const dishIngredientsQ = useQuery({
    queryKey: ["dish-ingredients", selectedDishId],
    queryFn: () => apiListDishIngredients(selectedDishId!),
    enabled: selectedDishId != null
  });

  const ingredientsQ = useQuery({
    queryKey: ["ingredients-search", ingredientQuery],
    queryFn: () => apiSearchIngredients(ingredientQuery),
    enabled: ingredientQuery.length >= 1
  });

  const createMenuM = useMutation({
    mutationFn: () => apiCreateMenu(restaurantId, { name: menuName }),
    onSuccess: async () => {
      setMenuName("");
      await queryClient.invalidateQueries({ queryKey: ["menus", restaurantId] });
    }
  });

  const updateMenuM = useMutation({
    mutationFn: (input: { isPublished: boolean }) => {
      if (selectedMenuId == null) throw new Error("No menu selected");
      return apiUpdateMenu(restaurantId, selectedMenuId, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["menus", restaurantId] });
    }
  });

  const createSectionM = useMutation({
    mutationFn: () => apiCreateSection(restaurantId, selectedMenuId!, { name: sectionName }),
    onSuccess: async () => {
      setSectionName("");
      await queryClient.invalidateQueries({ queryKey: ["sections", restaurantId, selectedMenuId] });
    }
  });

  const createDishM = useMutation({
    mutationFn: () =>
      apiCreateDish(restaurantId, selectedMenuId!, selectedSectionId!, {
        name: dishName,
        price: dishPrice
      }),
    onSuccess: async () => {
      setDishName("");
      setDishPrice("10.00");
      await queryClient.invalidateQueries({
        queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId]
      });
    }
  });

  const addIngredientM = useMutation({
    mutationFn: (ingredientId: number) => apiAddDishIngredient(selectedDishId!, { ingredientId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dish-ingredients", selectedDishId] });
    }
  });

  const requestIngredientM = useMutation({
    mutationFn: async (photos: File[]) => {
      const created = await apiRequestIngredient({
        canonicalName: requestIngredientName.trim(),
        restaurantId
      });
      for (const file of photos) {
        await apiUploadIngredientMedia(created.id, file);
      }
      return created;
    },
    onSuccess: async () => {
      setRequestIngredientName("");
      setRequestIngredientPhotos([]);
      setRequestIngredientError(null);
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; data?: { error?: string } };
      if (e?.status === 409) {
        setRequestIngredientError("That name is already in the dictionary or pending.");
        return;
      }
      if (e?.status === 403) {
        setRequestIngredientError("You cannot request ingredients for this restaurant.");
        return;
      }
      setRequestIngredientError(e?.data?.error ?? "Request failed.");
    }
  });

  const removeIngredientM = useMutation({
    mutationFn: (ingredientId: number) => apiRemoveDishIngredient(selectedDishId!, ingredientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dish-ingredients", selectedDishId] });
    }
  });

  const uploadDishMediaM = useMutation({
    mutationFn: async (files: File[]) => {
      if (selectedMenuId == null || selectedSectionId == null || selectedDishId == null) {
        throw new Error("Select menu, section, and dish");
      }
      for (const file of files) {
        await apiUploadDishMedia(restaurantId, selectedMenuId, selectedSectionId, selectedDishId, file);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId]
      });
    }
  });

  const deleteDishMediaM = useMutation({
    mutationFn: (mediaId: number) => {
      if (selectedMenuId == null || selectedSectionId == null || selectedDishId == null) {
        throw new Error("Select menu, section, and dish");
      }
      return apiDeleteDishMedia(restaurantId, selectedMenuId, selectedSectionId, selectedDishId, mediaId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId]
      });
    }
  });

  const reorderDishMediaM = useMutation({
    mutationFn: (orderedIds: number[]) => {
      if (selectedMenuId == null || selectedSectionId == null || selectedDishId == null) {
        throw new Error("Select menu, section, and dish");
      }
      return apiReorderDishMedia(restaurantId, selectedMenuId, selectedSectionId, selectedDishId, orderedIds);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId]
      });
    }
  });

  const uploadIngredientMediaM = useMutation({
    mutationFn: async ({ ingredientId, files }: { ingredientId: number; files: File[] }) => {
      for (const file of files) {
        await apiUploadIngredientMedia(ingredientId, file);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    }
  });

  const deleteIngredientMediaM = useMutation({
    mutationFn: ({ ingredientId, mediaId }: { ingredientId: number; mediaId: number }) =>
      apiDeleteIngredientMedia(ingredientId, mediaId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    }
  });

  const reorderIngredientMediaM = useMutation({
    mutationFn: ({ ingredientId, orderedIds }: { ingredientId: number; orderedIds: number[] }) =>
      apiReorderIngredientMedia(ingredientId, orderedIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ingredients-search"] });
    }
  });

  const updateDishM = useMutation({
    mutationFn: ({ description }: { description: string }) => {
      if (selectedMenuId == null || selectedSectionId == null || selectedDishId == null) {
        throw new Error("Select menu, section, and dish");
      }
      return apiUpdateDish(restaurantId, selectedMenuId, selectedSectionId, selectedDishId, { description });
    },
    onSuccess: async () => {
      setEditingDishId(null);
      await queryClient.invalidateQueries({
        queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId]
      });
    }
  });

  const deleteDishM = useMutation({
    mutationFn: (dishId: number) => {
      if (selectedMenuId == null || selectedSectionId == null) throw new Error("Select menu and section");
      return apiDeleteDish(restaurantId, selectedMenuId, selectedSectionId, dishId);
    },
    onSuccess: async () => {
      setSelectedDishId(null);
      await queryClient.invalidateQueries({
        queryKey: ["dishes", restaurantId, selectedMenuId, selectedSectionId]
      });
    }
  });

  const deleteSectionM = useMutation({
    mutationFn: (sectionId: number) => {
      if (selectedMenuId == null) throw new Error("Select menu");
      return apiDeleteSection(restaurantId, selectedMenuId, sectionId);
    },
    onSuccess: async () => {
      setSelectedSectionId(null);
      setSelectedDishId(null);
      await queryClient.invalidateQueries({ queryKey: ["sections", restaurantId, selectedMenuId] });
    }
  });

  const deleteMenuM = useMutation({
    mutationFn: (menuId: number) => apiDeleteMenu(restaurantId, menuId),
    onSuccess: async () => {
      setSelectedMenuId(null);
      setSelectedSectionId(null);
      setSelectedDishId(null);
      await queryClient.invalidateQueries({ queryKey: ["menus", restaurantId] });
    }
  });

  const ingredientMediaBusy =
    uploadIngredientMediaM.isPending ||
    deleteIngredientMediaM.isPending ||
    reorderIngredientMediaM.isPending;

  const selectedDish: Dish | undefined = useMemo(
    () => dishesQ.data?.find((d) => d.id === selectedDishId),
    [dishesQ.data, selectedDishId]
  );

  const sortedDishMedia = useMemo(() => {
    const media = selectedDish?.media ?? [];
    return [...media].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
  }, [selectedDish?.media]);

  const dishGalleryBusy =
    uploadDishMediaM.isPending || deleteDishMediaM.isPending || reorderDishMediaM.isPending;

  const canEditMenu = user?.role === "superadmin" || user?.role === "admin" || user?.role === "owner";

  const canManageIngredientMedia = (ing: Ingredient) =>
    user?.role === "superadmin" ||
    (ing.approvalStatus === "pending" &&
      ing.requestedByRestaurantId != null &&
      ing.requestedByRestaurantId === restaurantId);

  const selectedMenu = useMemo(
    () => menusQ.data?.find((m) => m.id === selectedMenuId),
    [menusQ.data, selectedMenuId]
  );

  const canDeleteSection = (sectionId: number): boolean => {
    const sectionDishes = dishesQ.data?.filter((d) => d.sectionId === sectionId) ?? [];
    return sectionDishes.length === 0;
  };

  if (!Number.isFinite(restaurantId)) {
    return <p className="text-sm text-red-600">Invalid restaurant id.</p>;
  }

  function onCreateMenu(e: FormEvent) {
    e.preventDefault();
    if (!menuName.trim()) return;
    createMenuM.mutate();
  }

  function onCreateSection(e: FormEvent) {
    e.preventDefault();
    if (!sectionName.trim() || selectedMenuId == null) return;
    createSectionM.mutate();
  }

  function onCreateDish(e: FormEvent) {
    e.preventDefault();
    if (!dishName.trim() || selectedMenuId == null || selectedSectionId == null) return;
    createDishM.mutate();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Menu builder</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create menu</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={onCreateMenu}>
            <Input value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Menu name" />
            <Button type="submit" disabled={createMenuM.isPending}>Create</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {menusQ.data?.map((menu) => (
              <div
                key={menu.id}
                className={`rounded border px-2 py-1 text-xs flex items-center gap-1 ${selectedMenuId === menu.id ? "bg-slate-900 text-white" : "bg-white"}`}
              >
                <button
                  onClick={() => {
                    setSelectedMenuId(menu.id);
                    setSelectedSectionId(null);
                    setSelectedDishId(null);
                  }}
                  className="flex-1 text-left"
                >
                  {menu.name}
                  {menu.isPublished ? (
                    <span
                      className={`ml-0.5 ${selectedMenuId === menu.id ? "text-emerald-300" : "text-emerald-600"}`}
                      title="Published"
                    >
                      ●
                    </span>
                  ) : null}
                </button>
                {canEditMenu && (
                  <button
                    onClick={() => {
                      if (confirm("Delete this menu?")) deleteMenuM.mutate(menu.id);
                    }}
                    disabled={deleteMenuM.isPending}
                    className={`text-red-700 hover:font-bold ${selectedMenuId === menu.id ? "text-red-300" : ""}`}
                    title="Delete menu"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {selectedMenu && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-600">
                <span className="text-slate-500">Public status:</span>{" "}
                <span
                  className={
                    selectedMenu.isPublished ? "font-medium text-emerald-700" : "font-medium text-amber-800"
                  }
                >
                  {selectedMenu.isPublished ? "Published" : "Draft"}
                </span>
                {selectedMenu.isPublished ? (
                  <span className="text-slate-500"> — shown on the diner menu</span>
                ) : null}
              </p>
              {!selectedMenu.isPublished ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => updateMenuM.mutate({ isPublished: true })}
                  disabled={updateMenuM.isPending}
                >
                  {updateMenuM.isPending ? "Publishing…" : "Publish menu"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => updateMenuM.mutate({ isPublished: false })}
                  disabled={updateMenuM.isPending}
                >
                  {updateMenuM.isPending ? "Updating…" : "Unpublish"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create section</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={onCreateSection}>
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder={selectedMenuId ? "Section name" : "Select a menu first"}
              disabled={selectedMenuId == null}
            />
            <Button type="submit" disabled={selectedMenuId == null || createSectionM.isPending}>Create</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {sectionsQ.data?.map((section) => {
              const canDelete = canDeleteSection(section.id);
              return (
                <div
                  key={section.id}
                  className={`rounded border px-2 py-1 text-xs flex items-center gap-1 ${selectedSectionId === section.id ? "bg-slate-900 text-white" : "bg-white"}`}
                >
                  <button
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedDishId(null);
                    }}
                    className="flex-1 text-left"
                  >
                    {section.name}
                  </button>
                  {canEditMenu && (
                    <button
                      onClick={() => {
                        if (!canDelete) {
                          alert("Remove all dishes in this section before deleting it.");
                          return;
                        }
                        if (confirm("Delete this section?")) deleteSectionM.mutate(section.id);
                      }}
                      disabled={deleteSectionM.isPending || !canDelete}
                      className={`text-red-700 hover:font-bold disabled:opacity-50 disabled:cursor-not-allowed ${selectedSectionId === section.id ? "text-red-300" : ""}`}
                      title={canDelete ? "Delete section" : "Remove all dishes first"}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create dish</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-2 sm:grid-cols-3" onSubmit={onCreateDish}>
            <Input
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder={selectedSectionId ? "Dish name" : "Select a section first"}
              disabled={selectedSectionId == null}
            />
            <Input
              value={dishPrice}
              onChange={(e) => setDishPrice(e.target.value)}
              placeholder="Price e.g. 12.50"
              disabled={selectedSectionId == null}
            />
            <Button type="submit" disabled={selectedSectionId == null || createDishM.isPending}>Create dish</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {dishesQ.data?.map((dish) => (
              <div
                key={dish.id}
                className={`rounded border px-2 py-1 text-xs flex items-center gap-1 ${selectedDishId === dish.id ? "bg-slate-900 text-white" : "bg-white"}`}
              >
                <button
                  onClick={() => setSelectedDishId(dish.id)}
                  className="flex-1 text-left"
                >
                  {dish.name} (${dish.price})
                </button>
                {canEditMenu && (
                  <button
                    onClick={() => {
                      if (confirm("Delete this dish?")) deleteDishM.mutate(dish.id);
                    }}
                    disabled={deleteDishM.isPending}
                    className={`text-red-700 hover:font-bold ${selectedDishId === dish.id ? "text-red-300" : ""}`}
                    title="Delete dish"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {selectedDishId != null && selectedMenuId != null && selectedSectionId != null && (
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
              {canEditMenu && (
                <div className="rounded bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-800">Dish description</p>
                  {editingDishId === selectedDishId ? (
                    <form
                      className="space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateDishM.mutate({ description: editingDishDescription });
                      }}
                    >
                      <textarea
                        value={editingDishDescription}
                        onChange={(e) => setEditingDishDescription(e.target.value)}
                        placeholder="Add a description..."
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        rows={3}
                      />
                      <div className="flex gap-1">
                        <button
                          type="submit"
                          disabled={updateDishM.isPending}
                          className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          {updateDishM.isPending ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingDishId(null)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <p className="mb-2 whitespace-pre-wrap text-xs text-slate-700">
                        {selectedDish?.description || <span className="italic text-slate-500">No description</span>}
                      </p>
                      <button
                        onClick={() => {
                          setEditingDishId(selectedDishId);
                          setEditingDishDescription(selectedDish?.description || "");
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs font-medium text-slate-800">Dish gallery (images and videos)</p>
              <p className="text-xs text-muted-foreground">
                Files are stored under the API <code className="rounded bg-slate-100 px-1">uploads/</code> folder; the
                database stores public paths or URLs (same format when you switch to cloud storage). {GALLERY_MULTI_FILE_HINT}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept={GALLERY_MEDIA_ACCEPT}
                  className="max-w-xs text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1"
                  disabled={dishGalleryBusy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) uploadDishMediaM.mutate(files);
                    e.target.value = "";
                  }}
                />
                {uploadDishMediaM.isPending ? <span className="text-xs text-slate-600">Uploading…</span> : null}
                {uploadDishMediaM.isError ? (
                  <span className="text-xs text-red-600">Upload failed.</span>
                ) : null}
              </div>
              {sortedDishMedia.length > 0 ? (
                <ul className="space-y-2">
                  {sortedDishMedia.map((m, index) => (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-start gap-2 rounded border border-slate-200 bg-slate-50/80 p-2"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-slate-200">
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
                      <div className="min-w-0 flex-1 text-xs text-slate-600">
                        <p className="font-medium capitalize text-slate-800">{m.kind}</p>
                        <code className="break-all text-[11px]">{m.url}</code>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={index === 0 || dishGalleryBusy}
                            onClick={() => {
                              const next = [...sortedDishMedia];
                              [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                              reorderDishMediaM.mutate(next.map((x) => x.id));
                            }}
                          >
                            Up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={index >= sortedDishMedia.length - 1 || dishGalleryBusy}
                            onClick={() => {
                              const next = [...sortedDishMedia];
                              [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                              reorderDishMediaM.mutate(next.map((x) => x.id));
                            }}
                          >
                            Down
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-red-200 text-xs text-red-700 hover:bg-red-50"
                            disabled={dishGalleryBusy}
                            onClick={() => deleteDishMediaM.mutate(m.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No gallery items yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tag ingredients {selectedDish ? `for ${selectedDish.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {Number.isFinite(restaurantId) && restaurantId > 0 && (
            <div className="mb-4 rounded border border-dashed border-slate-300 bg-slate-50/80 p-3">
              <p className="text-xs font-medium text-slate-800">Request a new ingredient</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Adds a pending entry. It does not appear in the global dictionary until a platform admin approves. Until
                then, only this restaurant can search and tag it.
              </p>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setRequestIngredientError(null);
                  if (!requestIngredientName.trim()) return;
                  requestIngredientM.mutate(requestIngredientPhotos);
                }}
              >
                <Input
                  className="max-w-xs flex-1"
                  value={requestIngredientName}
                  onChange={(e) => setRequestIngredientName(e.target.value)}
                  placeholder="e.g. Urfa pepper"
                  autoComplete="off"
                />
                <label className="flex max-w-[min(100%,14rem)] shrink-0 flex-col gap-0.5 text-xs text-slate-600">
                  <span className="whitespace-nowrap">Photos / videos</span>
                  <input
                    type="file"
                    multiple
                    accept={GALLERY_MEDIA_ACCEPT}
                    className="max-w-full"
                    disabled={requestIngredientM.isPending}
                    onChange={(e) => {
                      setRequestIngredientPhotos(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                  <span className="text-[10px] leading-tight text-muted-foreground">{GALLERY_MULTI_FILE_HINT}</span>
                </label>
                <Button type="submit" disabled={requestIngredientM.isPending || !requestIngredientName.trim()}>
                  {requestIngredientM.isPending ? "Submitting…" : "Submit request"}
                </Button>
              </form>
              {requestIngredientError && (
                <p className="mt-2 text-xs text-red-600">{requestIngredientError}</p>
              )}
            </div>
          )}
          <Input
            value={ingredientQuery}
            onChange={(e) => setIngredientQuery(e.target.value)}
            placeholder={selectedDishId ? "Search ingredient (garlic, milk...)" : "Select a dish first"}
            disabled={selectedDishId == null}
          />
          {selectedDishId != null && (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {dishIngredientsQ.data?.map((item) => (
                  <span key={item.id} className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs">
                    {item.canonicalName}
                    <button
                      onClick={() => removeIngredientM.mutate(item.ingredientId)}
                      className="text-red-700"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {ingredientsQ.data?.slice(0, 8).map((ingredient) => {
                  const sortedIngMedia = [...(ingredient.media ?? [])].sort(
                    (a, b) => a.displayOrder - b.displayOrder || a.id - b.id
                  );
                  return (
                    <div key={ingredient.id} className="rounded border border-slate-200 bg-white px-2 py-2 text-xs">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => addIngredientM.mutate(ingredient.id)}
                          className="flex-1 text-left font-medium hover:bg-slate-50"
                        >
                          {ingredient.canonicalName}
                          {ingredient.approvalStatus === "pending" && (
                            <span className="text-amber-800"> — pending approval</span>
                          )}
                        </button>
                      </div>
                      {canManageIngredientMedia(ingredient) ? (
                        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                          <p className="text-[11px] font-medium text-slate-700">Ingredient gallery</p>
                          <p className="text-[10px] leading-tight text-muted-foreground">{GALLERY_MULTI_FILE_HINT}</p>
                          {sortedIngMedia.length > 0 ? (
                            <ul className="space-y-2">
                              {sortedIngMedia.map((m, index) => (
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
                                        disabled={index === 0 || ingredientMediaBusy}
                                        onClick={() => {
                                          const next = [...sortedIngMedia];
                                          [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                                          reorderIngredientMediaM.mutate({
                                            ingredientId: ingredient.id,
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
                                        disabled={index >= sortedIngMedia.length - 1 || ingredientMediaBusy}
                                        onClick={() => {
                                          const next = [...sortedIngMedia];
                                          [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                                          reorderIngredientMediaM.mutate({
                                            ingredientId: ingredient.id,
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
                                        disabled={ingredientMediaBusy}
                                        onClick={() =>
                                          deleteIngredientMediaM.mutate({
                                            ingredientId: ingredient.id,
                                            mediaId: m.id
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
                            <p className="text-[11px] text-slate-500">No photos or videos yet.</p>
                          )}
                          <input
                            type="file"
                            multiple
                            accept={GALLERY_MEDIA_ACCEPT}
                            className="max-w-full text-[11px] file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1"
                            disabled={ingredientMediaBusy}
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []);
                              if (files.length > 0) {
                                uploadIngredientMediaM.mutate({ ingredientId: ingredient.id, files });
                              }
                              e.target.value = "";
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

