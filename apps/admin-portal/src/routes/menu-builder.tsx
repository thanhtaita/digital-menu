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
  type Dish
} from "../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { rememberRestaurantForBuilder } from "@/lib/last-restaurant";

export function MenuBuilderPage() {
  const params = useParams();
  const restaurantId = Number(params.restaurantId);
  const queryClient = useQueryClient();

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
  const [requestIngredientError, setRequestIngredientError] = useState<string | null>(null);

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
    mutationFn: () =>
      apiRequestIngredient({
        canonicalName: requestIngredientName.trim(),
        restaurantId
      }),
    onSuccess: async () => {
      setRequestIngredientName("");
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

  const selectedDish: Dish | undefined = useMemo(
    () => dishesQ.data?.find((d) => d.id === selectedDishId),
    [dishesQ.data, selectedDishId]
  );

  const selectedMenu = useMemo(
    () => menusQ.data?.find((m) => m.id === selectedMenuId),
    [menusQ.data, selectedMenuId]
  );

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
              <button
                key={menu.id}
                onClick={() => {
                  setSelectedMenuId(menu.id);
                  setSelectedSectionId(null);
                  setSelectedDishId(null);
                }}
                className={`rounded border px-2 py-1 text-xs ${selectedMenuId === menu.id ? "bg-slate-900 text-white" : "bg-white"}`}
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
            {sectionsQ.data?.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setSelectedSectionId(section.id);
                  setSelectedDishId(null);
                }}
                className={`rounded border px-2 py-1 text-xs ${selectedSectionId === section.id ? "bg-slate-900 text-white" : "bg-white"}`}
              >
                {section.name}
              </button>
            ))}
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
              <button
                key={dish.id}
                onClick={() => setSelectedDishId(dish.id)}
                className={`rounded border px-2 py-1 text-xs ${selectedDishId === dish.id ? "bg-slate-900 text-white" : "bg-white"}`}
              >
                {dish.name} (${dish.price})
              </button>
            ))}
          </div>
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
                  requestIngredientM.mutate();
                }}
              >
                <Input
                  className="max-w-xs flex-1"
                  value={requestIngredientName}
                  onChange={(e) => setRequestIngredientName(e.target.value)}
                  placeholder="e.g. Urfa pepper"
                  autoComplete="off"
                />
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
              <div className="mt-3 space-y-1">
                {ingredientsQ.data?.slice(0, 8).map((ingredient) => (
                  <button
                    key={ingredient.id}
                    onClick={() => addIngredientM.mutate(ingredient.id)}
                    className="block w-full rounded border px-2 py-1 text-left text-xs hover:bg-slate-100"
                  >
                    {ingredient.canonicalName}
                    {ingredient.approvalStatus === "pending" && (
                      <span className="text-amber-800"> — pending approval</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

