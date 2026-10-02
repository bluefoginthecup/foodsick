"use client";
import { useI18n } from "../i18n/context";

import { useEffect, useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { getFirebaseClient } from "../firebase/client";

export default function TestLoginPage() {
  const { t, text } = useI18n();
  const [message, setMessage] = useState("관리자 창에서 테스트 로그인을 준비하고 있습니다…");
  useEffect(() => {
    const opener = window.opener;
    if (!opener) return;
    let used = false;
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== opener || event.data?.type !== "test-login-token" || used) return;
      used = true;
      try {
        const client = getFirebaseClient();
        if (!client || typeof event.data.token !== "string") throw new Error("로그인 연결을 확인해주세요.");
        await signInWithCustomToken(client.auth, event.data.token);
        window.opener = null;
        window.location.replace("/report");
      } catch { setMessage("로그인하지 못했습니다. 창을 닫고 관리자 화면에서 다시 접속해주세요."); }
    };
    window.addEventListener("message", receive);
    opener.postMessage({ type: "test-login-ready" }, window.location.origin);
    const timeout = window.setTimeout(() => { if (!used) setMessage("연결이 만료되었습니다. 관리자 화면에서 다시 접속해주세요."); }, 60000);
    return () => { window.removeEventListener("message", receive); window.clearTimeout(timeout); };
  }, []);
  return <main className="narrow-page"><h1>{t("테스트 회원 접속")}</h1><p role="status">{text(message)}</p><p>{t("관리자 화면의 ‘회원으로 접속’ 버튼으로 여는 전용 창입니다.")}</p></main>;
}
