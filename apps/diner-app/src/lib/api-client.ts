import type { RestrictionResponse, CreateRestriction } from "@digital-menu/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";

export type CurrentUser = {
  id: number;
  email: string;
  role: string;
  displayName?: string | null;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = options.body;
  const hasBody = body !== undefined && body !== null;
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
  if (!res.ok) throw { status: res.status, data };
  return data as T;
}

export async function apiMe(): Promise<CurrentUser | null> {
  try {
    return await request<CurrentUser>("/auth/me");
  } catch (err) {
    const e = err as { status?: number };
    if (!e.status || e.status === 401) return null;
    throw err;
  }
}

export async function apiLogin(email: string, password: string): Promise<{ user: CurrentUser }> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function apiRegister(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ user: CurrentUser }> {
  return request("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export async function apiLogout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export async function apiGetRestrictions(): Promise<RestrictionResponse[]> {
  const res = await request<{ restrictions: RestrictionResponse[] }>("/users/me/restrictions");
  return res.restrictions;
}

export async function apiAddRestriction(input: CreateRestriction): Promise<RestrictionResponse> {
  const res = await request<{ restriction: RestrictionResponse }>("/users/me/restrictions", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return res.restriction;
}

export async function apiDeleteRestriction(id: number): Promise<void> {
  await request(`/users/me/restrictions/${id}`, { method: "DELETE" });
}

export async function apiSearchIngredients(q: string): Promise<{ id: number; canonicalName: string; slug: string }[]> {
  const res = await request<{ id: number; canonicalName: string; slug: string }[]>(
    `/ingredients?q=${encodeURIComponent(q)}`
  );
  return Array.isArray(res) ? res : [];
}
