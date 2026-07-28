import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { QueryClient } from "@tanstack/react-query";

// Backend base URL. Override at build time with EXPO_PUBLIC_API_URL, otherwise
// read from app.json's extra.apiUrl.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  "https://www.fusioncouples.co.uk";

const TOKEN_KEY = "fusion_auth_token";

// The native app authenticates with a JWT (the backend returns one from
// /api/login and /api/register). Store it in the device keychain.
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${p}`;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Make an authenticated request to the backend. Returns parsed JSON (or null
 * for empty bodies); throws ApiError with the server's message on failure.
 */
export async function apiRequest<T = any>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && (data as any).message) ||
      text ||
      res.statusText;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// React Query client with a default queryFn: the queryKey's first element is
// the API path, so useQuery({ queryKey: ["/api/matches"] }) just works.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => apiRequest("GET", queryKey[0] as string),
      retry: false,
      // Keep data "fresh" for 5 min so switching tabs shows instantly instead
      // of re-fetching (and re-spinning) every time.
      staleTime: 5 * 60_000,
      // Keep it in memory for half an hour after it's unused.
      gcTime: 30 * 60_000,
      refetchOnReconnect: true,
    },
  },
});

// The main screens' data — prefetched right after login so tabs are already
// warm by the time the user taps them (no first-open spinner).
export const PREFETCH_PATHS = [
  "/api/profile",
  "/api/matches",
  "/api/discover",
  "/api/likes",
  "/api/subscription-status",
];

export function prefetchCoreData(): void {
  for (const path of PREFETCH_PATHS) {
    queryClient.prefetchQuery({ queryKey: [path] }).catch(() => {});
  }
}

export function getWebSocketUrl(path = "/ws", token?: string | null): string {
  const wsBase = API_URL.replace(/^http/, "ws");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase}${p}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}
