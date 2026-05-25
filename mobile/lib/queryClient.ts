import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://antigravity.onrender.com";

// 쿠키를 AsyncStorage에 수동 저장하여 세션 유지
const COOKIE_KEY = "session_cookie";

export async function getStoredCookie(): Promise<string | null> {
  return AsyncStorage.getItem(COOKIE_KEY);
}

export async function storeCookie(cookie: string): Promise<void> {
  await AsyncStorage.setItem(COOKIE_KEY, cookie);
}

export async function clearCookie(): Promise<void> {
  await AsyncStorage.removeItem(COOKIE_KEY);
}

async function buildHeaders(hasBody: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  const cookie = await getStoredCookie();
  if (cookie) headers["Cookie"] = cookie;
  return headers;
}

async function handleSetCookie(res: Response): Promise<void> {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    // connect.sid=xxx; Path=/; ... 에서 쿠키값만 추출
    const cookiePart = setCookie.split(";")[0];
    await storeCookie(cookiePart);
  }
}

async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${BASE_URL}${url}`;
  const headers = await buildHeaders(!!data);
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  await handleSetCookie(res);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = (queryKey[0] as string).startsWith("http")
      ? queryKey[0] as string
      : `${BASE_URL}${queryKey[0]}`;
    const headers = await buildHeaders(false);
    const res = await fetch(url, { headers });
    await handleSetCookie(res);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    await throwIfResNotOk(res);
    return res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
