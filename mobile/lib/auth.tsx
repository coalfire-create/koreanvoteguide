import { createContext, useContext, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, clearCookie } from "./queryClient";

interface AuthUser {
  id: string;
  username: string;
  name: string;
  voteVerified: boolean;
  realNameVerified?: boolean;
  realName?: string | null;
  nickname?: string | null;
  nicknameUpdatedAt?: string | null;
  ageGroup?: number | null;
  gender?: "M" | "F" | null;
  badges: string[];
  postCount: number;
  favorites: string[];
  favoriteRegions: { code: string; name: string }[];
  isAdmin?: boolean;
}

interface RegisterPayload {
  username: string;
  password: string;
  name: string;
  phone: string;
  verificationCode: string;
  birthYear: number;
  agreeTos: boolean;
  agreePrivacy: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  mutate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery<{ user: AuthUser } | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: Infinity,
  });

  const user = data?.user ?? null;

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterPayload) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
      await clearCookie();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const login = useCallback(async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  }, [loginMutation]);

  const register = useCallback(async (data: RegisterPayload) => {
    await registerMutation.mutateAsync(data);
  }, [registerMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const mutate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, mutate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
