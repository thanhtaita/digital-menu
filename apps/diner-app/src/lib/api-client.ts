import type {
  RestrictionResponse,
  CreateRestriction,
  UserPreferenceResponse,
  CreatePost,
  CreateComment,
  UpdateProfile,
  PostResponse,
  PostListResponse,
  CommentListResponse,
  CommentResponse,
  UserPublicProfile,
  FollowListResponse,
  PostMediaItem,
  PublicMenuResponse,
} from "@digital-menu/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002/api/v1";

export type CurrentUser = {
  id: number;
  email: string;
  role: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = options.body;
  const hasBody = body !== undefined && body !== null;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
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

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ user: CurrentUser }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ user: CurrentUser }> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiLogout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export async function apiGetRestrictions(): Promise<RestrictionResponse[]> {
  const res = await request<{ restrictions: RestrictionResponse[] }>(
    "/users/me/restrictions",
  );
  return res.restrictions;
}

export async function apiAddRestriction(
  input: CreateRestriction,
): Promise<RestrictionResponse> {
  const res = await request<{ restriction: RestrictionResponse }>(
    "/users/me/restrictions",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.restriction;
}

export async function apiDeleteRestriction(id: number): Promise<void> {
  await request(`/users/me/restrictions/${id}`, { method: "DELETE" });
}

export async function apiSearchIngredients(
  q: string,
): Promise<{ id: number; canonicalName: string; slug: string }[]> {
  const res = await request<
    { id: number; canonicalName: string; slug: string }[]
  >(`/ingredients?q=${encodeURIComponent(q)}`);
  return Array.isArray(res) ? res : [];
}

export async function apiGetPreferences(): Promise<UserPreferenceResponse | null> {
  try {
    const res = await request<{ preference: UserPreferenceResponse }>("/users/me/preferences");
    return res.preference;
  } catch (err) {
    const e = err as { status?: number };
    if (e.status === 404) return null;
    throw err;
  }
}

export async function apiUpsertPreferences(preferenceText: string): Promise<UserPreferenceResponse> {
  const res = await request<{ preference: UserPreferenceResponse }>("/users/me/preferences", {
    method: "PUT",
    body: JSON.stringify({ preferenceText }),
  });
  return res.preference;
}

export async function apiDeletePreferences(): Promise<void> {
  await request("/users/me/preferences", { method: "DELETE" });
}

// ─── Social: profiles ─────────────────────────────────────────────────────────

export async function apiGetUserProfile(userId: number): Promise<UserPublicProfile> {
  return request<UserPublicProfile>(`/users/${userId}/profile`);
}

export async function apiUpdateProfile(data: UpdateProfile): Promise<void> {
  await request("/users/me/profile", { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiUploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ avatarUrl: string }>("/users/me/avatar", {
    method: "POST",
    body: form,
    headers: {},
  });
}

// ─── Social: follows ─────────────────────────────────────────────────────────

export async function apiFollowUser(userId: number): Promise<void> {
  await request(`/users/${userId}/follow`, { method: "POST" });
}

export async function apiUnfollowUser(userId: number): Promise<void> {
  await request(`/users/${userId}/follow`, { method: "DELETE" });
}

export async function apiGetFollowers(userId: number, before?: number): Promise<FollowListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  return request<FollowListResponse>(`/users/${userId}/followers?${params}`);
}

export async function apiGetFollowing(userId: number, before?: number): Promise<FollowListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  return request<FollowListResponse>(`/users/${userId}/following?${params}`);
}

// ─── Social: posts ───────────────────────────────────────────────────────────

export async function apiCreatePost(data: CreatePost): Promise<PostResponse> {
  const res = await request<{ post: PostResponse }>("/posts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.post;
}

export async function apiGetPost(postId: number): Promise<PostResponse> {
  const res = await request<{ post: PostResponse }>(`/posts/${postId}`);
  return res.post;
}

export async function apiDeletePost(postId: number): Promise<void> {
  await request(`/posts/${postId}`, { method: "DELETE" });
}

export async function apiGetUserPosts(userId: number, before?: number): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  return request<PostListResponse>(`/users/${userId}/posts?${params}`);
}

export async function apiGetRestaurantPosts(slug: string, before?: number): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  return request<PostListResponse>(`/public/restaurants/${encodeURIComponent(slug)}/posts?${params}`);
}

export async function apiGetFeed(before?: number): Promise<PostListResponse> {
  const params = new URLSearchParams();
  if (before !== undefined) params.set("before", String(before));
  return request<PostListResponse>(`/feed?${params}`);
}

export async function apiLikePost(postId: number): Promise<{ likeCount: number }> {
  return request<{ likeCount: number }>(`/posts/${postId}/like`, { method: "POST" });
}

export async function apiUnlikePost(postId: number): Promise<{ likeCount: number }> {
  return request<{ likeCount: number }>(`/posts/${postId}/like`, { method: "DELETE" });
}

export async function apiUploadPostMedia(postId: number, file: File): Promise<{ media: PostMediaItem[] }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ media: PostMediaItem[] }>(`/posts/${postId}/media`, {
    method: "POST",
    body: form,
    headers: {},
  });
}

// ─── Social: comments ────────────────────────────────────────────────────────

export async function apiGetComments(postId: number): Promise<CommentListResponse> {
  return request<CommentListResponse>(`/posts/${postId}/comments`);
}

export async function apiCreateComment(postId: number, data: CreateComment): Promise<CommentResponse> {
  const res = await request<{ comment: CommentResponse }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.comment;
}

export async function apiDeleteComment(postId: number, commentId: number): Promise<void> {
  await request(`/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
}

// ─── Social: feed ─────────────────────────────────────────────────────────────

// (apiGetFeed already defined above)

// ─── AI Chat ──────────────────────────────────────────────────────────────────

export type ChatRecommendation = {
  dishName: string;
  reason: string;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  recommendations?: ChatRecommendation[];
};

export type ChatSendResponse = {
  message: string;
  recommendations: ChatRecommendation[];
  sessionId: number;
};

export type ChatHistory = {
  restaurantName: string;
  messages: ChatMessage[];
  summary: string | null;
};

export async function apiSendChatMessage(slug: string, message: string): Promise<ChatSendResponse> {
  return request<ChatSendResponse>(
    `/public/restaurants/${encodeURIComponent(slug)}/chat`,
    { method: "POST", body: JSON.stringify({ message }) }
  );
}

type ChatStreamChunk =
  | { type: "chunk"; text: string }
  | { type: "done"; message: string; recommendations: ChatRecommendation[]; sessionId: number }
  | { type: "error"; code: string };

export async function apiSendChatMessageStream(
  slug: string,
  message: string,
  onChunk: (text: string) => void,
  onDone: (result: ChatSendResponse) => void,
  onError: (code: string) => void
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/public/restaurants/${encodeURIComponent(slug)}/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
  } catch {
    onError("NETWORK_ERROR");
    return;
  }

  if (!response.ok || !response.body) {
    onError("AI_ERROR");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as ChatStreamChunk;
        if (event.type === "chunk") {
          onChunk(event.text);
        } else if (event.type === "done") {
          onDone({ message: event.message, recommendations: event.recommendations, sessionId: event.sessionId });
        } else if (event.type === "error") {
          onError(event.code);
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
}

export async function apiGetChatHistory(slug: string): Promise<ChatHistory> {
  return request<ChatHistory>(`/public/restaurants/${encodeURIComponent(slug)}/chat/history`);
}

export async function apiClearChat(slug: string): Promise<void> {
  await request(`/public/restaurants/${encodeURIComponent(slug)}/chat`, { method: "DELETE" });
}

export async function apiGetPublicMenu(slug: string): Promise<PublicMenuResponse> {
  return request<PublicMenuResponse>(`/public/restaurants/${encodeURIComponent(slug)}/menu`);
}

export async function apiLikeDishRecommendation(
  slug: string,
  dishName: string,
  liked: boolean
): Promise<void> {
  await request(`/public/restaurants/${encodeURIComponent(slug)}/chat/like`, {
    method: "POST",
    body: JSON.stringify({ dishName, liked }),
  });
}
