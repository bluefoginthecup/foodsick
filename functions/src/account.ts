import { recordActivity } from "./activity.js";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { assertActiveAccount, requireUid } from "./common.js";
import { db } from "./firebase.js";

const options = { region: "asia-northeast3", enforceAppCheck: false };
export const getMyAccount = onCall(options, async (request) => {
  const uid = await requireUid(request);
  const snapshot = await db.collection("users").doc(uid).get();
  if (!snapshot.exists) throw new HttpsError("not-found", "계정 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
  const data = snapshot.data()!;
  return { uid, nickname: typeof data.nickname === "string" ? data.nickname : "", provider: "kakao",
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    lastLoginAt: data.lastLoginAt?.toDate?.().toISOString() ?? null };
});

export const updateMyAccount = onCall(options, async (request) => {
  const uid = await requireUid(request);
  const data = request.data;
  // Never accept a target UID or permission fields from the caller.
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some((key) => key !== "nickname") || typeof data.nickname !== "string") {
    throw new HttpsError("invalid-argument", "별명만 수정할 수 있습니다.");
  }
  const nickname: string = data.nickname.trim();
  if (nickname.length > 30 || Array.from(nickname).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new HttpsError("invalid-argument", "별명은 줄바꿈 없이 30자 이내로 입력해주세요.");
  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "계정 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
    assertActiveAccount(snapshot, request.auth?.token.sessionVersion);
    recordActivity(transaction, uid, "profile_updated");
    transaction.update(ref, { nickname, updatedAt: FieldValue.serverTimestamp() });
  });
  return { nickname };
});
