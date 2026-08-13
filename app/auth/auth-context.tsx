"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { beginKakaoLogin } from "../firebase/kakao-auth-api";
import { firebaseBackendEnabled, getFirebaseClient } from "../firebase/client";

export type SessionUser = {
  uid: string;
  provider: "kakao";
  identityVerified: false;
  identityProvider: null;
  identityKey: null;
  mode: "mock" | "firebase";
  role: "user" | "admin";
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  firebaseMode: boolean;
  loginWithKakao: (returnTo?: string) => Promise<void>;
  loginForDemo: () => void;
  loginAsAdminForDemo: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_USER_KEY = "foodsick.demo-user";

function saveSessionUser(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  else window.sessionStorage.removeItem(SESSION_USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const firebaseMode = firebaseBackendEnabled();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(firebaseMode);

  /* Authentication state is client-only, so restoration must happen after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (firebaseMode) {
      const client = getFirebaseClient();
      if (!client) {
        setLoading(false);
        return;
      }
      return onAuthStateChanged(client.auth, async (firebaseUser) => {
        if (!firebaseUser) {
          setUser(null);
          setLoading(false);
          return;
        }
        try {
          const token = await firebaseUser.getIdTokenResult();
          setUser({
            uid: firebaseUser.uid,
            provider: "kakao",
            identityVerified: false,
            identityProvider: null,
            identityKey: null,
            mode: "firebase",
            role: token.claims.role === "admin" ? "admin" : "user",
          });
        } finally {
          setLoading(false);
        }
      });
    }

    const stored = window.sessionStorage.getItem(SESSION_USER_KEY);
    if (stored) {
      try {
        const restored = JSON.parse(stored) as SessionUser;
        if (restored.mode === "mock" && (restored.role === "user" || restored.role === "admin")) setUser(restored);
      } catch {
        window.sessionStorage.removeItem(SESSION_USER_KEY);
      }
    }
    setLoading(false);
  }, [firebaseMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    firebaseMode,
    loginWithKakao: async (returnTo = "/report") => {
      if (!firebaseMode) throw new Error("현재 카카오 로그인이 활성화되지 않았습니다.");
      await beginKakaoLogin(returnTo);
    },
    loginForDemo: () => {
      if (firebaseMode) return;
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
      if (firebaseMode) return;
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
    logout: async () => {
      saveSessionUser(null);
      if (firebaseMode) {
        const client = getFirebaseClient();
        if (client) await signOut(client.auth);
      }
      setUser(null);
    },
  }), [firebaseMode, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
