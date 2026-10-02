import { FieldPath } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "./common.js";
import { db } from "./firebase.js";

export const getAdminMembers = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const { cursor, search = "" } = request.data ?? {};
  if ((cursor !== undefined && (typeof cursor !== "string" || !/^[\w-]{1,128}$/.test(cursor))) || typeof search !== "string" || (search && !/^[\w-]{1,128}$/.test(search))) {
    throw new HttpsError("invalid-argument", "회원 식별값을 확인해주세요.");
  }
  let query = db.collection("users").orderBy(FieldPath.documentId());
  if (search) query = query.startAt(search).endAt(`${search}\uf8ff`);
  if (cursor) query = query.startAfter(cursor);
  const result = await query.limit(31).get();
  const page = result.docs.slice(0, 30);
  const members = await Promise.all(page.map(async (doc) => {
    const data = doc.data();
    const reportCount = await db.collection("reports").where("ownerUid", "==", doc.id).count().get();
    return {
      uid: doc.id, provider: data.provider === "test" ? "테스트" : data.provider === "kakao" ? "카카오" : "기록 없음", role: data.role === "admin" ? "admin" : "user",
      createdAt: data.createdAt?.toDate?.().toISOString() ?? "", lastLoginAt: data.lastLoginAt?.toDate?.().toISOString() ?? "",
      reportCount: reportCount.data().count,
      nickname: typeof data.nickname === "string" ? data.nickname : "",
      status: data.status === "deleting" ? "deleting" : "active",
    };
  }));
  return { members, nextCursor: result.docs.length > 30 ? page[page.length - 1]?.id ?? null : null };
});

export const getMemberActivities = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  await requireAdmin(request);
  const { uid, cursor } = request.data ?? {};
  if (typeof uid !== "string" || !/^[\w-]{1,128}$/.test(uid) || (cursor !== undefined && (typeof cursor !== "string" || !/^[\w-]{1,128}$/.test(cursor)))) throw new HttpsError("invalid-argument", "회원 식별값을 확인해주세요.");
  let query = db.collection("memberActivities").where("ownerUid", "==", uid).orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (cursor) {
    const previous = await db.collection("memberActivities").doc(cursor).get();
    if (!previous.exists || previous.get("ownerUid") !== uid) throw new HttpsError("invalid-argument", "활동 기록 위치를 확인해주세요.");
    query = query.startAfter(previous);
  }
  const result = await query.limit(51).get();
  return { activities: result.docs.slice(0, 50).map((doc) => { const data = doc.data(); return { id: doc.id, action: data.action, reportId: data.reportId ?? null, actorUid: data.actorUid ?? null, createdAt: data.createdAt?.toDate?.().toISOString() ?? "" }; }), nextCursor: result.docs.length > 50 ? result.docs[49]?.id ?? null : null };
});
