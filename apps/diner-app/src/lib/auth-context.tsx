"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { RestrictionResponse } from "@digital-menu/shared";
import { apiMe, apiGetRestrictions, apiLogout, type CurrentUser } from "./api-client";

type AuthState = {
  user: CurrentUser | null;
  restrictions: RestrictionResponse[];
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  restrictions: [],
  loading: true,
  refresh: async () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [restrictions, setRestrictions] = useState<RestrictionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await apiMe();
      setUser(me);
      if (me) {
        const r = await apiGetRestrictions();
        setRestrictions(r);
      } else {
        setRestrictions([]);
      }
    } catch {
      setUser(null);
      setRestrictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setRestrictions([]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, restrictions, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
