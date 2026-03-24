import { z } from "zod";
import type { Role } from "@digital-menu/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3002/api/v1";

const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.string() as z.ZodType<Role>,
  displayName: z.string().nullable().optional()
});

export type CurrentUser = z.infer<typeof userSchema>;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {})
    },
    ...options
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    throw {
      status: res.status,
      data
    };
  }

  return data as T;
}

export async function apiLogin(email: string, password: string) {
  return request<{ user: CurrentUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function apiRegister(input: {
  email: string;
  password: string;
  displayName?: string;
  restaurantName?: string;
  restaurantSlug?: string;
}) {
  return request<{ user: CurrentUser; restaurantId: number | null }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function apiMe(): Promise<CurrentUser | null> {
  try {
    const me = await request<CurrentUser>("/auth/me", { method: "GET" });
    return me;
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 401) return null;
    // Network/offline/CORS: thrown errors often have no `status`
    if (e?.status == null) return null;
    throw err;
  }
}

export async function apiLogout() {
  await request<void>("/auth/logout", { method: "POST", body: "{}" });
}

const restaurantSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional()
});

export type Restaurant = z.infer<typeof restaurantSchema>;

export async function apiListRestaurants(): Promise<Restaurant[]> {
  const data = await request<unknown[]>("/restaurants", { method: "GET" });
  return z.array(restaurantSchema).parse(data);
}

const menuSchema = z.object({
  id: z.number(),
  restaurantId: z.number(),
  name: z.string(),
  isPublished: z.boolean(),
  displayOrder: z.number()
});
export type Menu = z.infer<typeof menuSchema>;

const sectionSchema = z.object({
  id: z.number(),
  menuId: z.number(),
  name: z.string(),
  displayOrder: z.number()
});
export type Section = z.infer<typeof sectionSchema>;

const dishSchema = z.object({
  id: z.number(),
  sectionId: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.string(),
  imageUrl: z.string().nullable().optional(),
  isAvailable: z.boolean(),
  displayOrder: z.number()
});
export type Dish = z.infer<typeof dishSchema>;

const ingredientSchema = z.object({
  id: z.number(),
  canonicalName: z.string(),
  slug: z.string()
});
export type Ingredient = z.infer<typeof ingredientSchema>;

const dishIngredientSchema = z.object({
  id: z.number(),
  dishId: z.number(),
  ingredientId: z.number(),
  isOptional: z.boolean(),
  isHidden: z.boolean(),
  displayOrder: z.number(),
  canonicalName: z.string(),
  slug: z.string()
});
export type DishIngredient = z.infer<typeof dishIngredientSchema>;

export async function apiListMenus(restaurantId: number): Promise<Menu[]> {
  const data = await request<unknown[]>(`/restaurants/${restaurantId}/menus`, { method: "GET" });
  return z.array(menuSchema).parse(data);
}

export async function apiCreateMenu(restaurantId: number, input: { name: string; displayOrder?: number }) {
  const data = await request<unknown>(`/restaurants/${restaurantId}/menus`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return menuSchema.parse(data);
}

export async function apiListSections(restaurantId: number, menuId: number): Promise<Section[]> {
  const data = await request<unknown[]>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections`,
    { method: "GET" }
  );
  return z.array(sectionSchema).parse(data);
}

export async function apiCreateSection(
  restaurantId: number,
  menuId: number,
  input: { name: string; displayOrder?: number }
) {
  const data = await request<unknown>(`/restaurants/${restaurantId}/menus/${menuId}/sections`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return sectionSchema.parse(data);
}

export async function apiListDishes(
  restaurantId: number,
  menuId: number,
  sectionId: number
): Promise<Dish[]> {
  const data = await request<unknown[]>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes`,
    { method: "GET" }
  );
  return z.array(dishSchema).parse(data);
}

export async function apiCreateDish(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  input: { name: string; description?: string; price: string; isAvailable?: boolean; displayOrder?: number }
) {
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
  return dishSchema.parse(data);
}

export async function apiSearchIngredients(q: string): Promise<Ingredient[]> {
  const query = q.trim();
  const data = await request<unknown[]>(`/ingredients${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
    method: "GET"
  });
  return z.array(ingredientSchema).parse(data);
}

export async function apiListDishIngredients(dishId: number): Promise<DishIngredient[]> {
  const data = await request<unknown[]>(`/dishes/${dishId}/ingredients`, { method: "GET" });
  return z.array(dishIngredientSchema).parse(data);
}

export async function apiAddDishIngredient(
  dishId: number,
  input: { ingredientId: number; isOptional?: boolean; isHidden?: boolean; displayOrder?: number }
) {
  const data = await request<unknown>(`/dishes/${dishId}/ingredients`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return dishIngredientSchema.parse(data);
}

export async function apiRemoveDishIngredient(dishId: number, ingredientId: number) {
  await request<void>(`/dishes/${dishId}/ingredients/${ingredientId}`, { method: "DELETE" });
}

