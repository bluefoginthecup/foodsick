import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "./common.js";
import { db } from "./firebase.js";

// Page by immutable document ID; never silently present a truncated page as totals.
export const getAdminAnalyticsPage = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async request => {
  await requireAdmin(request);
  const { source, cursor } = request.data ?? {};
  if (!["symptom", "cdc"].includes(source) || (cursor !== undefined && (typeof cursor !== "string" || !/^[\w-]{1,128}$/.test(cursor)))) throw new HttpsError("invalid-argument", "조회 조건을 확인해주세요.");
  let query = db.collection(source === "cdc" ? "cdcReports" : "reports").orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.limit(51).get();
  const page = snapshot.docs.slice(0, 50);
  const uids = [...new Set(page.map(doc => doc.get("ownerUid")).filter((uid): uid is string => typeof uid === "string" && /^[\w-]{1,128}$/.test(uid)))];
  const members = uids.length ? await db.getAll(...uids.map(uid => db.collection("users").doc(uid))) : [];
  const memberTypes = new Map(members.map(doc => [doc.id, !doc.exists ? "unknown" : doc.get("isTest") === true || doc.get("provider") === "test" ? "test" : "real"]));
  return {
    reports: page.map(doc => {
      const d = doc.data();
      return { id: doc.id, source, ownerUid: d.ownerUid ?? "", memberType: memberTypes.get(d.ownerUid) ?? "unknown", testBatchId: members.find(m => m.id === d.ownerUid)?.get("testBatchId") ?? "", publicMenus: d.publicMenus ?? null, menuReview: d.menuReview ?? null, status: d.status ?? "", draft: d.draft ?? null,
        createdAt: d.createdAt?.toDate?.().toISOString() ?? "", updatedAt: d.updatedAt?.toDate?.().toISOString() ?? "",
        incubationMinutes: d.incubationMinutes ?? null, sensitiveDataConsentVersion: d.sensitiveDataConsentVersion ?? d.consentVersion ?? "",
        reviewNote: d.reviewNote ?? "", revision: d.revision ?? 0, formVersion: d.formVersion ?? "" };
    }),
    nextCursor: snapshot.docs.length > 50 ? page.at(-1)!.id : null,
  };
});

export const recordAdminAnalyticsExport = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async request => {
  const actorUid = await requireAdmin(request);
  const d = request.data ?? {};
  const filters = d.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters) || !Number.isInteger(d.rowCount) || d.rowCount < 0 || d.rowCount > 10000 || typeof d.loadedAt !== "string" || !Number.isFinite(Date.parse(d.loadedAt))) throw new HttpsError("invalid-argument", "다운로드 조건을 확인해주세요.");
  const safe: Record<string, string> = {};
  for (const key of ["source", "memberType", "dateBasis", "start", "end", "region", "restaurant", "symptom", "status", "detailGroup", "detailKey"]) {
    if (typeof filters[key] !== "string" || filters[key].length > (key === "detailKey" ? 2400 : 200)) throw new HttpsError("invalid-argument", "다운로드 조건을 확인해주세요.");
    safe[key] = filters[key];
  }
  const audit = await db.collection("adminAuditLogs").add({ actorUid, action: "analytics_export_requested", filters: safe, requestedRowCount: d.rowCount, loadedAt: d.loadedAt, createdAt: FieldValue.serverTimestamp() });
  return { auditId: audit.id };
});
