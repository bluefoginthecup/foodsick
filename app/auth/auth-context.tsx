"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    loginForDemo: () => setUser({
      uid: "mock-kakao-user",
      provider: "kakao",
      identityVerified: false,
      identityProvider: null,
      identityKey: null,
      mode: "mock",
      role: "user",
    }),
    loginAsAdminForDemo: () => setUser({
      uid: "mock-admin-user",
      provider: "kakao",
      identityVerified: false,
      identityProvider: null,
      identityKey: null,
      mode: "mock",
      role: "admin",
    }),
    logout: () => setUser(null),
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
