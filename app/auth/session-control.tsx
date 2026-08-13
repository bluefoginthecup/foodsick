"use client";

import { useAuth } from "./auth-context";
import { NativeLink } from "../native-link";

export function SessionControl() {
  const { user, loading, logout } = useAuth();
  if (loading) return <span className="login-link">로그인 확인 중…</span>;
  if (!user) return <NativeLink className="login-link" href="/login">카카오로 시작하기</NativeLink>;
  return (
    <div className="session-control">
      <NativeLink href="/my-reports">내 신고</NativeLink>
      <span><i aria-hidden="true" /> {user.mode === "firebase" ? "카카오 로그인" : "체험 로그인"}</span>
      <button onClick={() => void logout()} type="button">로그아웃</button>
    </div>
  );
}
