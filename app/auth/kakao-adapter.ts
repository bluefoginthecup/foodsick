export type KakaoAuthConfig = {
  restApiKey: string;
  redirectUri: string;
};

export type KakaoIdentityExchange = {
  provider: "kakao";
  subjectHmac: string;
  firebaseCustomToken: string;
};

export function createKakaoAuthorizeUrl(config: KakaoAuthConfig, state: string) {
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", config.restApiKey);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

// 운영 구현은 서버에서만 다음 순서로 수행한다.
// code → Kakao access token → Kakao member id → HMAC subject → Firebase custom token.
// Kakao member id, access token, Firebase custom token은 URL이나 Firestore 공개 문서에 기록하지 않는다.
