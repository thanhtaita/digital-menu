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
  apiRemoveDishIngredient,
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
              </button>
            ))}
          </div>
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

