import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "../../shared/api/client";
import type { User } from "./auth.types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  sessionUnavailable: boolean;
  login(email: string, password: string): Promise<void>;
  signup(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api<{ user: User }>("/auth/session")
      .then((result) => {
        if (!cancelled) {
          setUser(result.user);
          setSessionUnavailable(false);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          setSessionUnavailable(false);
          return;
        }
        setSessionUnavailable(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    sessionUnavailable,
    async login(email, password) {
      const result = await api<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setUser(result.user);
      setSessionUnavailable(false);
    },
    async signup(name, email, password) {
      const result = await api<{ user: User }>("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
      setUser(result.user);
      setSessionUnavailable(false);
    },
    async logout() {
      await api<void>("/auth/logout", { method: "POST" });
      setUser(null);
      setSessionUnavailable(false);
    }
  }), [user, loading, sessionUnavailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
