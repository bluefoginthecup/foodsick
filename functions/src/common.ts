import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

export function requireUid(request: CallableRequest<unknown>) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "카카오 로그인이 필요합니다.");
  return request.auth.uid;
}

export function requireAdmin(request: CallableRequest<unknown>) {
  const uid = requireUid(request);
  if (request.auth?.token.role !== "admin") throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  return uid;
}
