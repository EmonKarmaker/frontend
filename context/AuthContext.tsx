"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  apiPost,
  apiAuthGet,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  UnauthorizedError,
} from "../lib/api";

/* ── Shared types ─────────────────────────────────────────────────── */

export interface UserResponse {
  id: number;
  household_id: number;
  household_name: string;
  name: string;
  email: string;
  is_admin: boolean;
  must_change_password: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

interface LoginResponse {
  access_token: string;
  token_type: "bearer";
}

/* ── Context shape ────────────────────────────────────────────────── */

interface AuthContextValue {
  user: UserResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ── Provider ─────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from stored token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiAuthGet<UserResponse>("/api/v1/auth/me")
      .then(setUser)
      .catch((e) => {
        // Stale or revoked token — clear it silently
        if (e instanceof UnauthorizedError) clearStoredToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await apiPost<LoginResponse>(
        "/api/v1/auth/login",
        { email, password }
      );
      setStoredToken(access_token);
      const me = await apiAuthGet<UserResponse>("/api/v1/auth/me");
      setUser(me);
      router.push(me.must_change_password ? "/change-password" : "/dashboard");
    },
    [router]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────────────── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
