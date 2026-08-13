"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SessionUser = {
  uid: string;
  provider: "kakao";
  identityVerified: false;
  identityProvider: null;
  identityKey: null;
  mode: "mock";
  role: "user" | "admin";
};

type AuthContextValue = {
  user: SessionUser | null;
  loginForDemo: () => void;
  loginAsAdminForDemo: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_USER_KEY = "foodsick.demo-user";

function saveSessionUser(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  else window.sessionStorage.removeItem(SESSION_USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  /* Session storage is client-only, so restoration must happen after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_USER_KEY);
    if (!stored) return;
    try {
      const restored = JSON.parse(stored) as SessionUser;
      if (restored.mode === "mock" && (restored.role === "user" || restored.role === "admin")) setUser(restored);
    } catch {
      window.sessionStorage.removeItem(SESSION_USER_KEY);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loginForDemo: () => {
      const nextUser: SessionUser = {
        uid: "mock-kakao-user",
        provider: "kakao",
        identityVerified: false,
        identityProvider: null,
        identityKey: null,
        mode: "mock",
        role: "user",
      };
      saveSessionUser(nextUser);
      setUser(nextUser);
    },
    loginAsAdminForDemo: () => {
      const nextUser: SessionUser = {
        uid: "mock-admin-user",
        provider: "kakao",
        identityVerified: false,
        identityProvider: null,
        identityKey: null,
        mode: "mock",
        role: "admin",
      };
      saveSessionUser(nextUser);
      setUser(nextUser);
    },
    logout: () => {
      saveSessionUser(null);
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
