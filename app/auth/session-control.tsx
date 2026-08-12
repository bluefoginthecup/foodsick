"use client";

import Link from "next/link";
import { useAuth } from "./auth-context";

export function SessionControl() {
  const { user, logout } = useAuth();
  if (!user) return <Link className="login-link" href="/login">카카오로 시작하기</Link>;
  return (
    <div className="session-control">
      <span><i aria-hidden="true" /> 체험 로그인</span>
      <button onClick={logout} type="button">로그아웃</button>
    </div>
  );
}
