import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiRequest, setToken, clearToken, getToken } from "./api";
import { queryClient, prefetchCoreData } from "./api";

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  subscriptionStatus?: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { email: string; password: string; firstName: string; lastName?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiRequest<User>("GET", "/api/auth/user");
      setUser(me);
      prefetchCoreData(); // warm the tabs while the splash plays
    } catch {
      // Token invalid/expired — clear it
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<{ user: User; token: string }>("POST", "/api/login", {
      email,
      password,
    });
    await setToken(res.token);
    setUser(res.user);
    prefetchCoreData();
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; firstName: string; lastName?: string }) => {
      const res = await apiRequest<{ user: User; token: string }>("POST", "/api/register", input);
      await setToken(res.token);
      setUser(res.user);
    },
    []
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
