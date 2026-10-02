import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { assertActiveAccount, requireAdmin, requireUid } from "./common.js";
import { db } from "./firebase.js";

const options = { region: "asia-northeast3", enforceAppCheck: false };
const categories = ["논문·연구", "공식 기관·사이트", "통계·데이터", "예방·증상 안내"];
function id(value: unknown) {
  if (typeof value !== "string" || !/^[\w-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", "게시글 번호를 확인해주세요.");
  return value;
}
function text(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) throw new HttpsError("invalid-argument", `${label}을(를) 확인해주세요. (최대 ${max}자)`);
  return value.trim();
}
function draft(value: unknown) {
  if (!value || typeof value !== "object") throw new HttpsError("invalid-argument", "게시글 내용을 확인해주세요.");
  const d = value as Record<string, unknown>;
  const type = text(d.type, "자료 유형", 30, true);
  const language = text(d.language, "언어", 10, true);
  if (!categories.includes(type) || !["한국어", "영어"].includes(language)) throw new HttpsError("invalid-argument", "자료 유형과 언어를 확인해주세요.");
  const url = text(d.url, "원문 주소", 2000, true);
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch { throw new HttpsError("invalid-argument", "http 또는 https 원문 주소를 입력해주세요."); }
  const year = text(d.year ?? "", "발행 연도", 4);
  if (year && !/^\d{4}$/.test(year)) throw new HttpsError("invalid-argument", "발행 연도는 네 자리로 입력해주세요.");
  if (!Array.isArray(d.tags) || d.tags.length > 6) throw new HttpsError("invalid-argument", "주제는 6개까지 입력해주세요.");
  return { type, language, url, year, title: text(d.title, "제목", 160, true), source: text(d.source, "출처", 200, true), originalTitle: text(d.originalTitle ?? "", "원문 제목", 400), description: text(d.description, "소개", 5000, true), takeaway: text(d.takeaway ?? "", "활용 안내", 2000), tags: [...new Set(d.tags.map(t => text(t, "주제", 30, true)))] };
}
function serialize(doc: FirebaseFirestore.DocumentSnapshot, privateView: boolean) {
  const d = doc.data()!;
  return { id: doc.id, ...draft(d.draft), createdAt: d.createdAt?.toDate?.().toISOString() ?? "", updatedAt: d.updatedAt?.toDate?.().toISOString() ?? "", ...(privateView ? { ownerUid: d.ownerUid, revision: d.revision, status: d.status, reviewNote: d.reviewNote ?? "" } : {}) };
}

export const listResourcePosts = onCall(options, async request => {
  const scope = request.data?.scope ?? "public";
  if (!["public", "mine", "admin"].includes(scope)) throw new HttpsError("invalid-argument", "조회 범위를 확인해주세요.");
  const uid = scope === "admin" ? await requireAdmin(request) : scope === "mine" ? await requireUid(request) : null;
  let query = db.collection("resourcePosts").orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (scope === "public") query = query.where("status", "==", "approved");
  if (scope === "mine") query = query.where("ownerUid", "==", uid);
  if (request.data?.cursor) {
    const previous = await db.collection("resourcePosts").doc(id(request.data.cursor)).get();
    if (!previous.exists || (scope === "public" && previous.get("status") !== "approved") || (scope === "mine" && previous.get("ownerUid") !== uid)) throw new HttpsError("invalid-argument", "목록이 변경되었습니다. 새로고침해주세요.");
    query = query.startAfter(previous);
  }
  const result = await query.limit(31).get();
  return { posts: result.docs.slice(0, 30).map(doc => serialize(doc, scope !== "public")), nextCursor: result.size > 30 ? result.docs[29]!.id : null };
});

export const saveResourcePost = onCall(options, async request => {
  const uid = await requireUid(request);
  const admin = request.auth?.token.role === "admin";
  const data = draft(request.data?.draft);
  const ref = db.collection("resourcePosts").doc(id(request.data?.id));
  const revision = request.data?.revision;
  if (!Number.isInteger(revision) || revision < 0) throw new HttpsError("invalid-argument", "게시글 버전을 확인해주세요.");
  await db.runTransaction(async tx => {
    const [account, existing] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(ref)]);
    assertActiveAccount(account, request.auth?.token.sessionVersion);
    if (existing.exists && existing.get("ownerUid") !== uid && !admin) throw new HttpsError("permission-denied", "본인 게시글만 수정할 수 있습니다.");
    if ((existing.get("revision") ?? 0) !== revision) throw new HttpsError("aborted", "다른 화면에서 변경된 글입니다. 목록을 새로고침해주세요.");
    if (!admin && !existing.exists) {
      const rateRef = db.collection("rateLimits").doc(`resources-${uid}`);
      const rate = await tx.get(rateRef);
      const day = new Date().toISOString().slice(0, 10);
      const count = rate.get("day") === day ? Number(rate.get("count") ?? 0) : 0;
      if (count >= 20) throw new HttpsError("resource-exhausted", "하루에 새 글을 20개까지 올릴 수 있습니다.");
      tx.set(rateRef, { uid, day, count: count + 1 });
    }
    tx.set(ref, { draft: data, ownerUid: existing.exists ? existing.get("ownerUid") : uid, revision: revision + 1, status: admin ? "approved" : "pending", reviewNote: "", reviewedBy: admin ? uid : null, reviewedAt: admin ? FieldValue.serverTimestamp() : null, updatedAt: FieldValue.serverTimestamp(), ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
  });
  return { id: ref.id, revision: revision + 1, status: admin ? "approved" : "pending" };
});

export const reviewResourcePost = onCall(options, async request => {
  const uid = await requireAdmin(request);
  const ref = db.collection("resourcePosts").doc(id(request.data?.id));
  const status = request.data?.status;
  if (!["approved", "rejected"].includes(status)) throw new HttpsError("invalid-argument", "검토 결과를 확인해주세요.");
  const note = text(request.data?.note ?? "", "검토 메모", 1000, status === "rejected");
  await db.runTransaction(async tx => {
    const [account, existing] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(ref)]);
    assertActiveAccount(account, request.auth?.token.sessionVersion);
    if (!existing.exists) throw new HttpsError("not-found", "게시글이 없습니다.");
    if (existing.get("revision") !== request.data?.revision) throw new HttpsError("aborted", "내용이 변경되었습니다. 목록을 새로고침한 뒤 검토해주세요.");
    tx.update(ref, { status, reviewNote: note, revision: existing.get("revision") + 1, reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});

export const deleteResourcePost = onCall(options, async request => {
  const uid = await requireUid(request);
  const ref = db.collection("resourcePosts").doc(id(request.data?.id));
  await db.runTransaction(async tx => {
    const [account, existing] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(ref)]);
    assertActiveAccount(account, request.auth?.token.sessionVersion);
    if (!existing.exists) throw new HttpsError("not-found", "게시글이 없습니다.");
    if (existing.get("ownerUid") !== uid && request.auth?.token.role !== "admin") throw new HttpsError("permission-denied", "본인 게시글만 삭제할 수 있습니다.");
    if (existing.get("revision") !== request.data?.revision) throw new HttpsError("aborted", "내용이 변경되었습니다. 목록을 새로고침해주세요.");
    tx.delete(ref);
  });
  return { ok: true };
});
