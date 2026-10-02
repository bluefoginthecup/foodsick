import { FieldPath } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "./common.js";
import { db } from "./firebase.js";

// Full report content is returned only after verifying the server-side admin claim.
export const getAdminReports = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  requireAdmin(request);
  const cursor = request.data?.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || !/^[\w-]{1,128}$/.test(cursor))) {
    throw new HttpsError("invalid-argument", "다음 목록 위치를 확인해주세요.");
  }
  let query = db.collection("reports").orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (cursor) {
    const previous = await db.collection("reports").doc(cursor).get();
    if (!previous.exists) throw new HttpsError("failed-precondition", "목록을 새로고침해주세요.");
    query = query.startAfter(previous);
  }
  const snapshot = await query.limit(51).get();
  const page = snapshot.docs.slice(0, 50);
  return {
    reports: page.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id, ownerUid: data.ownerUid, status: data.status, draft: data.draft ?? null,
        incubationMinutes: data.incubationMinutes ?? null,
        createdAt: data.createdAt?.toDate?.().toISOString() ?? "",
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? "",
        sensitiveDataConsentVersion: data.sensitiveDataConsentVersion ?? "",
      };
    }),
    nextCursor: snapshot.docs.length > 50 ? page[page.length - 1]?.id ?? null : null,
  };
});
