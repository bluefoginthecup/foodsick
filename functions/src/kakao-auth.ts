import { randomBytes } from "node:crypto";
import type { Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { db } from "./firebase.js";
import { kakaoFirebaseUid, safeReturnTo, sha256Base64Url } from "./domain/kakao-auth.js";

const region = "asia-northeast3";
const kakaoRestApiKey = defineSecret("KAKAO_REST_API_KEY");
const kakaoClientSecret = defineSecret("KAKAO_CLIENT_SECRET");
const kakaoSubjectSecret = defineSecret("KAKAO_SUBJECT_HMAC_SECRET");
const publicSiteUrl = defineString("PUBLIC_SITE_URL", {
  default: "https://apayo-signal-map.designmonster.chatgpt.site",
});
const kakaoRedirectUri = defineString("KAKAO_REDIRECT_URI", {
  default: "https://asia-northeast3-foodsick-signal-map-kr.cloudfunctions.net/kakaoLoginCallback",
});

const STATE_TTL_MS = 10 * 60_000;
const EXCHANGE_TTL_MS = 5 * 60_000;

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function loginUrl(path = "/login") {
  return new URL(path, publicSiteUrl.value());
}

function redirectWithError(response: Response, code: string) {
  const target = loginUrl();
  target.searchParams.set("error", code);
  response.set("Cache-Control", "no-store");
  response.redirect(303, target.toString());
}

async function exchangeAuthorizationCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: kakaoRestApiKey.value(),
    redirect_uri: kakaoRedirectUri.value(),
    code,
  });
  const clientSecret = kakaoClientSecret.value().trim();
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  if (!response.ok) throw new Error(`Kakao token exchange failed (${response.status})`);
  const token = await response.json() as { access_token?: unknown };
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("Kakao access token missing");
  return token.access_token;
}

async function fetchKakaoMemberId(accessToken: string) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Kakao user lookup failed (${response.status})`);
  const member = await response.json() as { id?: unknown };
  if (typeof member.id !== "number" && typeof member.id !== "string") throw new Error("Kakao member id missing");
  return String(member.id);
}

export const beginKakaoLogin = onCall({
  region,
  enforceAppCheck: false,
  secrets: [kakaoRestApiKey],
}, async (request) => {
  const returnTo = safeReturnTo((request.data as { returnTo?: unknown } | null)?.returnTo);
  const state = randomToken();
  const now = Date.now();
  const stateRef = db.collection("kakaoAuthStates").doc(sha256Base64Url(state));

  await stateRef.create({
    returnTo,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + STATE_TTL_MS),
  });

  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", kakaoRestApiKey.value());
  authorizeUrl.searchParams.set("redirect_uri", kakaoRedirectUri.value());
  authorizeUrl.searchParams.set("state", state);
  return { authorizeUrl: authorizeUrl.toString() };
});

export const kakaoLoginCallback = onRequest({
  region,
  secrets: [kakaoRestApiKey, kakaoClientSecret, kakaoSubjectSecret],
}, async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.status(405).send("Method not allowed");
    return;
  }

  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";
  if (!code || !state) {
    redirectWithError(response, request.query.error ? "kakao_cancelled" : "invalid_callback");
    return;
  }

  const stateRef = db.collection("kakaoAuthStates").doc(sha256Base64Url(state));
  let returnTo = "/report";
  try {
    returnTo = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef);
      if (!snapshot.exists || snapshot.get("claimedAt")) throw new Error("Invalid login state");
      const expiresAt = snapshot.get("expiresAt");
      if (!(expiresAt instanceof Timestamp) || expiresAt.toMillis() <= Date.now()) throw new Error("Expired login state");
      transaction.update(stateRef, { claimedAt: FieldValue.serverTimestamp() });
      return safeReturnTo(snapshot.get("returnTo"));
    });

    const accessToken = await exchangeAuthorizationCode(code);
    const kakaoMemberId = await fetchKakaoMemberId(accessToken);
    const uid = kakaoFirebaseUid(kakaoSubjectSecret.value(), kakaoMemberId);
    const exchange = randomToken();
    const exchangeRef = db.collection("kakaoAuthExchanges").doc(sha256Base64Url(exchange));
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (transaction) => {
      const user = await transaction.get(userRef);
      transaction.create(exchangeRef, {
        uid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + EXCHANGE_TTL_MS),
      });
      transaction.set(userRef, {
        provider: "kakao",
        role: user.exists && user.get("role") === "admin" ? "admin" : "user",
        identityVerified: false,
        updatedAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
        ...(!user.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
      }, { merge: true });
    });

    const target = loginUrl("/login");
    target.searchParams.set("exchange", exchange);
    target.searchParams.set("returnTo", returnTo);
    response.redirect(303, target.toString());
  } catch (error) {
    console.error("Kakao login callback failed", error instanceof Error ? error.message : "unknown error");
    redirectWithError(response, "kakao_login_failed");
  }
});

export const completeKakaoLogin = onCall({ region, enforceAppCheck: false }, async (request) => {
  const exchange = (request.data as { exchange?: unknown } | null)?.exchange;
  if (typeof exchange !== "string" || exchange.length < 32 || exchange.length > 128) {
    throw new HttpsError("invalid-argument", "로그인 확인값이 올바르지 않습니다.");
  }

  const exchangeRef = db.collection("kakaoAuthExchanges").doc(sha256Base64Url(exchange));
  const { uid, role } = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(exchangeRef);
    if (!snapshot.exists || snapshot.get("usedAt")) throw new HttpsError("failed-precondition", "이미 사용했거나 만료된 로그인입니다.");
    const expiresAt = snapshot.get("expiresAt");
    if (!(expiresAt instanceof Timestamp) || expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError("deadline-exceeded", "로그인 시간이 만료되었습니다. 다시 시작해주세요.");
    }
    const exchangeUid = snapshot.get("uid");
    if (typeof exchangeUid !== "string") throw new HttpsError("internal", "로그인 정보를 확인하지 못했습니다.");
    const user = await transaction.get(db.collection("users").doc(exchangeUid));
    transaction.update(exchangeRef, { usedAt: FieldValue.serverTimestamp() });
    return { uid: exchangeUid, role: user.exists && user.get("role") === "admin" ? "admin" : "user" } as const;
  });

  const customToken = await getAuth().createCustomToken(uid, {
    provider: "kakao",
    role,
    identityVerified: false,
  });
  return { customToken };
});
