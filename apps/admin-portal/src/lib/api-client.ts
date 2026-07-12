import { z } from "zod";
import type {
  CreateIngredientInput,
  RequestIngredientInput,
  UpdateIngredientInput,
  UpsertTranslationInput,
  Role,
  SuggestIngredientsRequest
} from "@digital-menu/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3002/api/v1";

const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.string() as z.ZodType<Role>,
  displayName: z.string().nullable().optional()
});

export type CurrentUser = z.infer<typeof userSchema>;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = options.body;
  const hasBody = body !== undefined && body !== null;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
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

const dishMediaSchema = z.object({
  id: z.number(),
  url: z.string(),
  kind: z.enum(["image", "video"]),
  displayOrder: z.number()
});
export type DishMedia = z.infer<typeof dishMediaSchema>;

const dishSchema = z.object({
  id: z.number(),
  sectionId: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.string(),
  imageUrl: z.string().nullable().optional(),
  isAvailable: z.boolean(),
  displayOrder: z.number(),
  media: z.array(dishMediaSchema).optional()
});
export type Dish = z.infer<typeof dishSchema>;

const ingredientMediaItemSchema = z.object({
  id: z.number(),
  url: z.string(),
  kind: z.enum(["image", "video"]),
  displayOrder: z.number()
});
export type IngredientMediaItem = z.infer<typeof ingredientMediaItemSchema>;

const ingredientSchema = z.object({
  id: z.number(),
  canonicalName: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  fdcId: z.number().nullable().optional(),
  foodCategory: z.string().nullable().optional(),
  nutrients: z.unknown().nullable().optional(),
  isCommonAllergen: z.boolean(),
  commonAllergenGroup: z.string().nullable().optional(),
  approvalStatus: z.enum(["pending", "approved"]),
  requestedByRestaurantId: z.number().nullable().optional(),
  media: z.array(ingredientMediaItemSchema).optional()
});
export type Ingredient = z.infer<typeof ingredientSchema>;

const pendingIngredientRowSchema = z.object({
  id: z.number(),
  canonicalName: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  approvalStatus: z.literal("pending"),
  requestedByRestaurantId: z.number().nullable(),
  restaurantName: z.string().nullable().optional()
});
export type PendingIngredientRow = z.infer<typeof pendingIngredientRowSchema>;

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

export async function apiUpdateMenu(
  restaurantId: number,
  menuId: number,
  input: { name?: string; isPublished?: boolean; displayOrder?: number }
) {
  const data = await request<unknown>(`/restaurants/${restaurantId}/menus/${menuId}`, {
    method: "PATCH",
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
  input: {
    name: string;
    description?: string;
    price: string;
    imageUrl?: string;
    isAvailable?: boolean;
    displayOrder?: number;
  }
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

const dishImageUploadResponseSchema = z.object({
  imageUrl: z.string(),
  dish: dishSchema
});

export async function apiUploadDishImage(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  file: File
) {
  const form = new FormData();
  form.append("file", file);
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/image`,
    { method: "POST", body: form }
  );
  return dishImageUploadResponseSchema.parse(data);
}

const dishMediaUploadResponseSchema = z.object({
  media: dishMediaSchema
});

export async function apiUploadDishMedia(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  file: File
) {
  const form = new FormData();
  form.append("file", file);
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/media`,
    { method: "POST", body: form }
  );
  return dishMediaUploadResponseSchema.parse(data);
}

export async function apiDeleteDishMedia(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  mediaId: number
) {
  await request<void>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/media/${mediaId}`,
    { method: "DELETE" }
  );
}

const dishMediaReorderResponseSchema = z.object({
  media: z.array(dishMediaSchema)
});

export async function apiReorderDishMedia(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  orderedIds: number[]
) {
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/media/order`,
    {
      method: "PATCH",
      body: JSON.stringify({ orderedIds })
    }
  );
  return dishMediaReorderResponseSchema.parse(data);
}

const ingredientImageUploadResponseSchema = z.object({
  imageUrl: z.string(),
  ingredient: ingredientSchema
});

export async function apiUploadIngredientImage(ingredientId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const data = await request<unknown>(`/ingredients/${ingredientId}/image`, { method: "POST", body: form });
  return ingredientImageUploadResponseSchema.parse(data);
}

const ingredientMediaUploadResponseSchema = z.object({
  media: ingredientMediaItemSchema
});

export async function apiUploadIngredientMedia(ingredientId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const data = await request<unknown>(`/ingredients/${ingredientId}/media`, { method: "POST", body: form });
  return ingredientMediaUploadResponseSchema.parse(data);
}

export async function apiDeleteIngredientMedia(ingredientId: number, mediaId: number) {
  await request<void>(`/ingredients/${ingredientId}/media/${mediaId}`, { method: "DELETE" });
}

const ingredientMediaReorderResponseSchema = z.object({
  media: z.array(ingredientMediaItemSchema)
});

export async function apiReorderIngredientMedia(ingredientId: number, orderedIds: number[]) {
  const data = await request<unknown>(`/ingredients/${ingredientId}/media/order`, {
    method: "PATCH",
    body: JSON.stringify({ orderedIds })
  });
  return ingredientMediaReorderResponseSchema.parse(data);
}

export async function apiListIngredients(offset: number, limit = 20): Promise<Ingredient[]> {
  const data = await request<unknown[]>(`/ingredients?limit=${limit}&offset=${offset}`, { method: "GET" });
  return z.array(ingredientSchema).parse(data);
}

export async function apiSearchIngredients(q: string): Promise<Ingredient[]> {
  const query = q.trim();
  const data = await request<unknown[]>(`/ingredients${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
    method: "GET"
  });
  return z.array(ingredientSchema).parse(data);
}

export async function apiCreateIngredient(input: CreateIngredientInput): Promise<Ingredient> {
  const data = await request<unknown>("/ingredients", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return ingredientSchema.parse(data);
}

export async function apiRequestIngredient(input: RequestIngredientInput): Promise<Ingredient> {
  const data = await request<unknown>("/ingredients", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return ingredientSchema.parse(data);
}

export async function apiListPendingIngredients(): Promise<PendingIngredientRow[]> {
  const data = await request<unknown[]>("/ingredients/pending", { method: "GET" });
  return z.array(pendingIngredientRowSchema).parse(data);
}

export async function apiApproveIngredient(id: number): Promise<Ingredient> {
  const data = await request<unknown>(`/ingredients/${id}/approve`, { method: "POST", body: "{}" });
  return ingredientSchema.parse(data);
}

export async function apiRejectIngredient(id: number): Promise<void> {
  await request<void>(`/ingredients/${id}`, { method: "DELETE" });
}

export async function apiUpdateIngredient(id: number, input: UpdateIngredientInput): Promise<Ingredient> {
  const data = await request<unknown>(`/ingredients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return ingredientSchema.parse(data);
}

const fdcCandidateRowSchema = z.object({
  id: z.number(),
  ingredientId: z.number(),
  ingredientCanonicalName: z.string(),
  fdcId: z.number(),
  fdcDescription: z.string(),
  score: z.number(),
  status: z.literal("pending"),
  createdAt: z.string()
});
export type FdcCandidateRow = z.infer<typeof fdcCandidateRowSchema>;

export async function apiListFdcCandidates(): Promise<FdcCandidateRow[]> {
  const data = await request<unknown[]>("/ingredients/fdc-candidates", { method: "GET" });
  return z.array(fdcCandidateRowSchema).parse(data);
}

export async function apiAcceptFdcCandidate(id: number): Promise<Ingredient> {
  const data = await request<unknown>(`/ingredients/fdc-candidates/${id}/accept`, {
    method: "POST",
    body: "{}"
  });
  return ingredientSchema.parse(data);
}

export async function apiRejectFdcCandidate(id: number): Promise<void> {
  await request<void>(`/ingredients/fdc-candidates/${id}/reject`, { method: "POST", body: "{}" });
}

export async function apiDeleteIngredient(id: number): Promise<void> {
  await request<void>(`/ingredients/${id}`, { method: "DELETE" });
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

export async function apiUpdateDish(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  input: {
    name?: string;
    description?: string | null;
    price?: string;
    imageUrl?: string;
    isAvailable?: boolean;
    displayOrder?: number;
  }
) {
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
  return dishSchema.parse(data);
}

export async function apiDeleteDish(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number
) {
  await request<void>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}`,
    { method: "DELETE" }
  );
}

export async function apiDeleteMenu(restaurantId: number, menuId: number) {
  await request<void>(`/restaurants/${restaurantId}/menus/${menuId}`, { method: "DELETE" });
}

export async function apiUpdateSection(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  input: { name?: string; displayOrder?: number }
) {
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
  return sectionSchema.parse(data);
}

export async function apiDeleteSection(restaurantId: number, menuId: number, sectionId: number) {
  await request<void>(`/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}`, {
    method: "DELETE"
  });
}

export async function apiUpdateRestaurant(
  restaurantId: number,
  input: { name?: string; slug?: string; description?: string | null }
): Promise<Restaurant> {
  const data = await request<unknown>(`/restaurants/${restaurantId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return restaurantSchema.parse(data);
}

// ── Translation helpers ───────────────────────────────────────────────────

const translationRowSchema = z.object({
  id: z.number(),
  locale: z.string(),
  name: z.string(),
  description: z.string().nullable().optional()
});

export type TranslationRow = z.infer<typeof translationRowSchema>;

// Dish translations

export async function apiListDishTranslations(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number
): Promise<TranslationRow[]> {
  const data = await request<unknown[]>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/translations`,
    { method: "GET" }
  );
  return z.array(translationRowSchema).parse(data);
}

export async function apiUpsertDishTranslation(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  input: UpsertTranslationInput
): Promise<TranslationRow> {
  const data = await request<unknown>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/translations/${encodeURIComponent(input.locale)}`,
    { method: "PUT", body: JSON.stringify({ name: input.name, description: input.description }) }
  );
  return translationRowSchema.parse(data);
}

export async function apiDeleteDishTranslation(
  restaurantId: number,
  menuId: number,
  sectionId: number,
  dishId: number,
  locale: string
): Promise<void> {
  await request<void>(
    `/restaurants/${restaurantId}/menus/${menuId}/sections/${sectionId}/dishes/${dishId}/translations/${encodeURIComponent(locale)}`,
    { method: "DELETE" }
  );
}

// Ingredient translations

export async function apiListIngredientTranslations(ingredientId: number): Promise<TranslationRow[]> {
  const data = await request<unknown[]>(`/ingredients/${ingredientId}/translations`, { method: "GET" });
  return z.array(translationRowSchema).parse(data);
}

export async function apiUpsertIngredientTranslation(
  ingredientId: number,
  input: UpsertTranslationInput
): Promise<TranslationRow> {
  const data = await request<unknown>(
    `/ingredients/${ingredientId}/translations/${encodeURIComponent(input.locale)}`,
    { method: "PUT", body: JSON.stringify({ name: input.name, description: input.description }) }
  );
  return translationRowSchema.parse(data);
}

export async function apiDeleteIngredientTranslation(ingredientId: number, locale: string): Promise<void> {
  await request<void>(
    `/ingredients/${ingredientId}/translations/${encodeURIComponent(locale)}`,
    { method: "DELETE" }
  );
}

// ── AI ingredient suggestions ─────────────────────────────────────────────

export type AiMatchedIngredient = {
  id: number;
  canonicalName: string;
  slug: string;
  status: "approved" | "pending";
};

export type AiIngredientSuggestion = {
  suggestedName: string;
  matchedIngredient: AiMatchedIngredient | null;
  confidence: "high" | "medium" | "low";
  shouldCreate: boolean;
  category?: string;
};

export type SuggestIngredientsResponse = {
  suggestions: AiIngredientSuggestion[];
  metadata: { model: string; tokensUsed: number; latencyMs: number };
};

export async function apiSuggestIngredients(
  input: SuggestIngredientsRequest
): Promise<SuggestIngredientsResponse> {
  return request<SuggestIngredientsResponse>("/dishes/suggest-ingredients", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
