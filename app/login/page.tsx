"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../auth/auth-context";
import { completeKakaoLogin } from "../firebase/kakao-auth-api";
import { NativeLink } from "../native-link";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/report";
  return value;
}

const loginErrorMessage: Record<string, string> = {
  kakao_cancelled: "카카오 로그인이 취소되었습니다.",
  invalid_callback: "로그인 응답을 확인하지 못했습니다. 다시 시도해주세요.",
  kakao_login_failed: "카카오 로그인을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.",
};

export default function LoginPage() {
  const { user, loading, firebaseMode, loginWithKakao, loginForDemo, loginAsAdminForDemo, logout } = useAuth();
  const searchParams = useSearchParams();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const exchanging = firebaseMode && Boolean(searchParams.get("exchange"));
  const callbackError = searchParams.get("exchange")
    ? ""
    : loginErrorMessage[searchParams.get("error") || ""] || "";

  useEffect(() => {
    if (!firebaseMode) return;
    const exchange = searchParams.get("exchange");
    if (!exchange) return;

    const returnTo = safeReturnTo(searchParams.get("returnTo"));
    window.history.replaceState({}, "", "/login");
    completeKakaoLogin(exchange)
      .then(() => window.location.replace(returnTo))
      .catch(() => {
        setError("로그인 확인 시간이 만료되었거나 이미 사용되었습니다. 다시 시작해주세요.");
        setWorking(false);
      });
  }, [firebaseMode, searchParams]);

  const handleLogin = async () => {
    setError("");
    setWorking(true);
    try {
      if (firebaseMode) await loginWithKakao("/report");
      else {
        loginForDemo();
        window.location.assign("/report");
      }
    } catch {
      setError("카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setWorking(false);
    }
  };

  return (
    <main className="narrow-page">
      <NativeLink className="back-link" href="/">← 지도로 돌아가기</NativeLink>
      <section className="login-card">
        <span className="kakao-symbol" aria-hidden="true">K</span>
        <p className="eyebrow">신고 전 한 번만</p>
        <h1>카카오 계정으로<br />중복 신고를 줄여요</h1>
        <p className="login-copy">
          실명 확인이 아닙니다. 같은 계정의 반복 신고를 줄이기 위해 카카오 회원 식별값을 안전하게 변환한 내부 UID만 사용합니다.
        </p>
        <ul className="privacy-list">
          <li>프로필 이름·이메일을 요청하지 않아요</li>
          <li>카카오 회원번호와 로그인 토큰을 저장하지 않아요</li>
          <li>신고 내용은 계정 소유자와 관리자만 확인해요</li>
        </ul>

        {(error || callbackError) && <p className="form-error" role="alert">{error || callbackError}</p>}
        {loading || working || (exchanging && !error) ? (
          <button className="kakao-button" disabled type="button">로그인 확인 중…</button>
        ) : user ? (
          <div className="logged-in-panel">
            <strong>{user.mode === "firebase" ? "카카오 계정으로 로그인되어 있어요" : "체험 계정으로 로그인되어 있어요"}</strong>
            <NativeLink className="primary-button" href="/report">증상 신고하기</NativeLink>
            <button className="secondary-button" onClick={() => void logout()} type="button">로그아웃</button>
          </div>
        ) : (
          <button className="kakao-button" onClick={() => void handleLogin()} type="button">
            <span aria-hidden="true">●</span> 카카오로 시작하기
          </button>
        )}
        {!firebaseMode && !user && (
          <button className="admin-demo-button" onClick={() => { loginAsAdminForDemo(); window.location.assign("/admin"); }} type="button">
            관리자 화면 체험하기
          </button>
        )}
        <p className="demo-notice">
          {firebaseMode
            ? "카카오 프로필·이메일 동의 없이 회원 식별값만 확인합니다. 실명 인증 기능은 아닙니다."
            : "현재는 외부 키 없이 동작을 확인하는 체험 모드입니다. 실제 카카오 인증이나 계정 정보 조회는 수행하지 않습니다."}
        </p>
      </section>
    </main>
  );
}
