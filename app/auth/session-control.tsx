"use client";

import { useAuth } from "./auth-context";
import { NativeLink } from "../native-link";

export function SessionControl() {
  const { user, logout } = useAuth();
  if (!user) return <NativeLink className="login-link" href="/login">카카오로 시작하기</NativeLink>;
  return (
    <div className="session-control">
      <NativeLink href="/my-reports">내 신고</NativeLink>
      <span><i aria-hidden="true" /> 체험 로그인</span>
      <button onClick={logout} type="button">로그아웃</button>
    </div>
  );
}
