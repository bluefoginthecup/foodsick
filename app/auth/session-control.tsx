"use client";
import { useI18n } from "../i18n/context";


import { useAuth } from "./auth-context";
import { NativeLink } from "../native-link";

export function SessionControl() {
  const { t, text } = useI18n();
  const { user, loading, logout } = useAuth();
  if (loading) return <span className="login-link">{t("로그인 확인 중…")}</span>;
  if (!user) return <NativeLink className="login-link" href="/login">{t("카카오로 시작하기")}</NativeLink>;
  return (
    <div className="session-control">
      <NativeLink href="/my-reports">{t("내 신고")}</NativeLink>
      <span><i aria-hidden="true" /> {text(user.provider === "test" ? "테스트 로그인" : user.mode === "firebase" ? "카카오 로그인" : "체험 로그인")}</span>
      <button onClick={() => void logout()} type="button">{t("로그아웃")}</button>
    </div>
  );
}
