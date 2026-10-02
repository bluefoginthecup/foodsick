import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireUid, requireAdmin, assertActiveAccount } from "./common.js";
import { db } from "./firebase.js";
import { recordActivity } from "./activity.js";
import { validateCdcDraft } from "./domain/cdc.js";
const options = { region: "asia-northeast3", enforceAppCheck: false };
function id(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "신고 번호를 확인해주세요.");
  return value;
}
export const saveCdcReport = onCall(options, async request => {
  const uid = await requireUid(request);
  if (JSON.stringify(request.data ?? {}).length > 80000) throw new HttpsError("invalid-argument", "신고 내용이 너무 깁니다.");
  const { draft, issues } = validateCdcDraft(request.data?.draft);
  if (issues.length) throw new HttpsError("invalid-argument", issues[0]!.message, { issues });
  const reportId = id(request.data?.id);
  const revision = request.data?.revision;
  if (!Number.isInteger(revision) || revision < 0) throw new HttpsError("invalid-argument", "신고 버전을 확인해주세요.");
  const ref = db.collection("cdcReports").doc(reportId);
  await db.runTransaction(async tx => {
    const [account, existing] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(ref)]);
    assertActiveAccount(account, request.auth?.token.sessionVersion);
    if (existing.exists && existing.get("ownerUid") !== uid) throw new HttpsError("permission-denied", "본인 신고만 수정할 수 있습니다.");
    if ((existing.get("revision") ?? 0) !== revision || (!existing.exists && revision !== 0)) throw new HttpsError("aborted", "다른 화면에서 변경된 신고입니다. 다시 불러온 뒤 수정해주세요.");
    tx.set(ref, { ownerUid: uid, draft, revision: revision + 1, formVersion: "nhgq-2025-ko-pilot-v1", consentVersion: "cdc-pilot-2026-10", status: "submitted", reviewNote: "", updatedAt: FieldValue.serverTimestamp(), ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
    recordActivity(tx, uid, existing.exists ? "cdc_report_updated" : "cdc_report_created", reportId);
  });
  return { id: reportId, revision: revision + 1 };
});
export const listCdcReports = onCall(options, async request => {
  const uid = await requireUid(request);
  const admin = request.data?.admin === true;
  if (admin) await requireAdmin(request);
  const owner = admin ? (request.data?.ownerUid ? id(request.data.ownerUid) : null) : uid;
  const reportId = request.data?.id ? id(request.data.id) : null;
  const serialize = (doc: FirebaseFirestore.DocumentSnapshot) => { const d = doc.data()!; return { id: doc.id, ownerUid: d.ownerUid, draft: d.draft, revision: d.revision, status: d.status, reviewNote: d.reviewNote ?? "", formVersion: d.formVersion, createdAt: d.createdAt?.toDate().toISOString() ?? "", updatedAt: d.updatedAt?.toDate().toISOString() ?? "" }; };
  if (reportId) {
    const doc = await db.collection("cdcReports").doc(reportId).get();
    if (!doc.exists || (!admin && doc.get("ownerUid") !== uid) || (owner && doc.get("ownerUid") !== owner)) throw new HttpsError("not-found", "신고를 찾을 수 없습니다.");
    return { reports: [serialize(doc)], nextCursor: null };
  }
  let query = db.collection("cdcReports").orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (owner) query = query.where("ownerUid", "==", owner);
  if (request.data?.cursor) {
    const cursor = await db.collection("cdcReports").doc(id(request.data.cursor)).get();
    if (!cursor.exists || (owner && cursor.get("ownerUid") !== owner)) throw new HttpsError("invalid-argument", "목록 위치를 확인해주세요.");
    query = query.startAfter(cursor);
  }
  const result = await query.limit(31).get();
  return { reports: result.docs.slice(0, 30).map(serialize), nextCursor: result.size > 30 ? result.docs[29]!.id : null };
});
export const deleteCdcReport = onCall(options, async request => {
  const uid = await requireUid(request);
  const ref = db.collection("cdcReports").doc(id(request.data?.id));
  await db.runTransaction(async tx => {
    const [account, report] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(ref)]);
    assertActiveAccount(account, request.auth?.token.sessionVersion);
    if (!report.exists || report.get("ownerUid") !== uid) throw new HttpsError("not-found", "본인 신고를 찾을 수 없습니다.");
    tx.delete(ref); recordActivity(tx, uid, "cdc_report_deleted", ref.id);
  });
  return { ok: true };
});
export const reviewCdcReport = onCall(options, async request => {
  const actor = await requireAdmin(request);
  const ref = db.collection("cdcReports").doc(id(request.data?.id));
  const { note, revision } = request.data ?? {};
  if (typeof note !== "string" || note.length > 1000) throw new HttpsError("invalid-argument", "검토 메모는 1,000자 이내로 입력해주세요.");
  await db.runTransaction(async tx => {
    const [account, report] = await Promise.all([tx.get(db.collection("users").doc(actor)), tx.get(ref)]);
    assertActiveAccount(account, request.auth?.token.sessionVersion);
    if (!report.exists) throw new HttpsError("not-found", "신고가 없습니다.");
    if (report.get("revision") !== revision) throw new HttpsError("aborted", "신고 내용이 변경되었습니다. 새로고침 후 검토해주세요.");
    tx.update(ref, { status: "reviewed", reviewNote: note.trim(), reviewedBy: actor, reviewedAt: FieldValue.serverTimestamp() });
    recordActivity(tx, report.get("ownerUid"), "cdc_report_reviewed", ref.id, actor);
  });
  return { ok: true };
});
