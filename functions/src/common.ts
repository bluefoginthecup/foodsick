import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { db } from "./firebase.js";

export function assertActiveAccount(snapshot: DocumentSnapshot, version?: unknown) {
  const data = snapshot.data();
  if (!snapshot.exists || data?.status === "deleting" || data?.status === "withdrawn" || (data?.sessionVersion && data.sessionVersion !== version)) {
    throw new HttpsError("unauthenticated", "사용할 수 없는 계정입니다. 다시 로그인해주세요.");
  }
}

export async function requireUid(request: CallableRequest<unknown>) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "카카오 로그인이 필요합니다.");
  assertActiveAccount(await db.collection("users").doc(request.auth.uid).get(), request.auth.token.sessionVersion);
  return request.auth.uid;
}

export async function requireAdmin(request: CallableRequest<unknown>) {
  if (request.auth?.token.role !== "admin") throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  const uid = await requireUid(request);
  return uid;
}
