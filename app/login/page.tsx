"use client";

import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";

export default function LoginPage() {
  const { user, loginForDemo, loginAsAdminForDemo, logout } = useAuth();

  const handleLogin = () => {
    loginForDemo();
    window.location.assign("/report");
  };

  return (
    <main className="narrow-page">
      <NativeLink className="back-link" href="/">← 지도로 돌아가기</NativeLink>
      <section className="login-card">
        <span className="kakao-symbol" aria-hidden="true">K</span>
        <p className="eyebrow">신고 전 한 번만</p>
        <h1>카카오 계정으로<br />중복 신고를 줄여요</h1>
        <p className="login-copy">
          실명 확인이 아닙니다. 같은 계정의 반복 신고를 줄이기 위해 카카오 회원 식별값만 내부 UID와 연결합니다.
        </p>
        <ul className="privacy-list">
          <li>프로필 이름·이메일을 요청하지 않아요</li>
          <li>카카오 회원번호를 외부에 공개하지 않아요</li>
          <li>신고 내용은 계정 소유자와 관리자만 확인해요</li>
        </ul>

        {user ? (
          <div className="logged-in-panel">
            <strong>체험 계정으로 로그인되어 있어요</strong>
            <button className="secondary-button" onClick={logout} type="button">로그아웃</button>
          </div>
        ) : (
          <button className="kakao-button" onClick={handleLogin} type="button">
            <span aria-hidden="true">●</span> 카카오로 시작하기
          </button>
        )}
        {!user && (
          <button className="admin-demo-button" onClick={() => { loginAsAdminForDemo(); window.location.assign("/admin"); }} type="button">
            관리자 화면 체험하기
          </button>
        )}
        <p className="demo-notice">
          현재는 외부 키 없이 동작을 확인하는 체험 모드입니다. 실제 카카오 인증이나 계정 정보 조회는 수행하지 않습니다.
        </p>
      </section>
    </main>
  );
}
