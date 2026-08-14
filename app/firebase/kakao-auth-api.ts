"use client";

import { signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "./client";

type BeginResponse = { authorizeUrl: string };
type CompleteResponse = { customToken: string };

function requiredClient() {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase 로그인 설정을 확인해주세요.");
  return client;
}

export async function beginKakaoLogin(returnTo: string) {
  const client = requiredClient();
  const begin = httpsCallable<{ returnTo: string; siteOrigin: string }, BeginResponse>(client.functions, "beginKakaoLogin");
  const result = await begin({ returnTo, siteOrigin: window.location.origin });
  if (!result.data.authorizeUrl.startsWith("https://kauth.kakao.com/")) {
    throw new Error("카카오 로그인 주소를 확인하지 못했습니다.");
  }
  window.location.assign(result.data.authorizeUrl);
}

export async function completeKakaoLogin(exchange: string) {
  const client = requiredClient();
  const complete = httpsCallable<{ exchange: string }, CompleteResponse>(client.functions, "completeKakaoLogin");
  const result = await complete({ exchange });
  if (!result.data.customToken) throw new Error("로그인 토큰을 확인하지 못했습니다.");
  await signInWithCustomToken(client.auth, result.data.customToken);
}
