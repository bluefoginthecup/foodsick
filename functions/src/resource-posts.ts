import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { assertActiveAccount, requireAdmin, requireUid } from "./common.js";
import { db } from "./firebase.js";
import { randomUUID } from "node:crypto";
import { attachmentIssue, type Attachment, MAX_TOTAL_BYTES } from "./domain/attachment-policy.js";
import { decodeAttachment } from "./domain/attachment-format.js";
import { putResourceFile, readResourceFile, removeResourceFile } from "./resource-file-store.js";

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
  const url = text(d.url ?? "", "원문 주소", 2000);
  try { if (url) {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } } catch { throw new HttpsError("invalid-argument", "http 또는 https 원문 주소를 입력해주세요."); }
  const year = text(d.year ?? "", "발행 연도", 4);
  if (year && !/^\d{4}$/.test(year)) throw new HttpsError("invalid-argument", "발행 연도는 네 자리로 입력해주세요.");
  if (!Array.isArray(d.tags) || d.tags.length > 6) throw new HttpsError("invalid-argument", "주제는 6개까지 입력해주세요.");
  return { type, language, url, year, title: text(d.title, "제목", 160, true), source: text(d.source, "출처", 200, true), originalTitle: text(d.originalTitle ?? "", "원문 제목", 400), description: text(d.description, "소개", 5000, true), takeaway: text(d.takeaway ?? "", "활용 안내", 2000), tags: [...new Set(d.tags.map(t => text(t, "주제", 30, true)))] };
}
function serialize(doc: FirebaseFirestore.DocumentSnapshot, privateView: boolean) {
  const d = doc.data()!;
  return { id: doc.id, ...draft(d.draft), attachments: (d.attachments ?? []).map((file: Attachment) => ({ id: file.id, name: file.name, size: file.size, extension: file.extension })), createdAt: d.createdAt?.toDate?.().toISOString() ?? "", updatedAt: d.updatedAt?.toDate?.().toISOString() ?? "", ...(privateView ? { ownerUid: d.ownerUid, revision: d.revision, status: d.status, reviewNote: d.reviewNote ?? "" } : {}) };
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

export const saveResourcePost = onCall({ ...options, memory: "1GiB", concurrency: 4, timeoutSeconds: 120, maxInstances: 10 }, async request => {
  const uid = await requireUid(request);
  const admin = request.auth?.token.role === "admin";
  const data = draft(request.data?.draft);
  const ref = db.collection("resourcePosts").doc(id(request.data?.id));
  const revision = request.data?.revision;
  if (!Number.isInteger(revision) || revision < 0) throw new HttpsError("invalid-argument", "게시글 버전을 확인해주세요.");
  const initial = await ref.get();
  if (initial.exists && initial.get("ownerUid") !== uid && !admin) throw new HttpsError("permission-denied", "본인 게시글만 수정할 수 있습니다.");
  if ((initial.get("revision") ?? 0) !== revision) throw new HttpsError("aborted", "다른 화면에서 변경된 글입니다. 목록을 새로고침해주세요.");
  const previous: Attachment[] = initial.get("attachments") ?? [];
  const input = request.data?.attachments ?? previous.map(file => ({ id: file.id }));
  if (!Array.isArray(input) || input.length > 3) throw new HttpsError("invalid-argument", "첨부파일은 최대 3개까지 올릴 수 있습니다.");
  const fresh: { file: Attachment; bytes: Buffer }[] = [];
  const attachments: Attachment[] = [];
  try {
    for (const item of input) {
      if (!item || typeof item !== "object") throw new Error("첨부파일 정보를 확인해주세요.");
      if (item.id !== undefined) {
        const kept = previous.find(file => file.id === item.id);
        if (!kept || attachments.some(file => file.id === kept.id)) throw new Error("현재 게시글의 첨부파일만 유지할 수 있습니다.");
        attachments.push(kept);
      } else {
        const decoded = decodeAttachment(item.name, item.base64);
        const file = { id: randomUUID(), name: decoded.name, size: decoded.size, extension: decoded.extension };
        attachments.push(file); fresh.push({ file, bytes: decoded.bytes });
      }
    }
    const issue = attachmentIssue(attachments);
    if (issue) throw new Error(issue);
    if (!data.url && !attachments.length) throw new Error("원문 주소 또는 첨부파일 중 하나를 입력해주세요.");
  } catch (error) { throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "첨부파일을 확인해주세요."); }
  if (fresh.length) {
    // Reserve an upload budget before writing objects, including unsuccessful saves.
    await db.runTransaction(async tx => {
      const rateRef = db.collection("rateLimits").doc(`resource-files-${uid}`);
      const [account, rate] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(rateRef)]);
      assertActiveAccount(account, request.auth?.token.sessionVersion);
      const day = new Date().toISOString().slice(0, 10);
      const bytes = (rate.get("day") === day ? Number(rate.get("bytes") ?? 0) : 0) + fresh.reduce((sum, file) => sum + file.file.size, 0);
      if (bytes > MAX_TOTAL_BYTES * 20) throw new HttpsError("resource-exhausted", "오늘의 첨부파일 업로드 한도를 초과했습니다. 내일 다시 시도해주세요.");
      tx.set(rateRef, { uid, day, bytes });
    });
  }
  const uploaded: Attachment[] = [];
  try {
    for (const file of fresh) {
      uploaded.push(file.file);
      await putResourceFile(ref.id, file.file.id, file.bytes);
    }
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
    tx.set(ref, { draft: data, attachments, ownerUid: existing.exists ? existing.get("ownerUid") : uid, revision: revision + 1, status: admin ? "approved" : "pending", reviewNote: "", reviewedBy: admin ? uid : null, reviewedAt: admin ? FieldValue.serverTimestamp() : null, updatedAt: FieldValue.serverTimestamp(), ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
  });
  } catch (error) {
    // A lost commit acknowledgement is ambiguous: never delete a file now referenced by a post.
    try {
      const current = await ref.get();
      const retained = new Set((current.get("attachments") ?? []).map((file: Attachment) => file.id));
      await Promise.all(uploaded.filter(file => !retained.has(file.id)).map(file => removeResourceFile(ref.id, file.id)));
    } catch { console.warn("Deferred resource attachment cleanup to scheduled sweep"); }
    throw error;
  }
  return { id: ref.id, revision: revision + 1, status: admin ? "approved" : "pending" };
});

export const downloadResourceAttachment = onCall({ ...options, memory: "512MiB", concurrency: 4, timeoutSeconds: 60, maxInstances: 10 }, async request => {
  request.rawRequest?.res?.set("Cache-Control", "private, no-store");
  const postId = id(request.data?.postId), fileId = id(request.data?.fileId);
  const ref = db.collection("resourcePosts").doc(postId);
  const post = await ref.get();
  if (!post.exists) throw new HttpsError("not-found", "파일을 찾을 수 없습니다.");
  if (post.get("status") !== "approved") {
    const uid = await requireUid(request);
    if (post.get("ownerUid") !== uid && request.auth?.token.role !== "admin") throw new HttpsError("permission-denied", "승인 전 파일은 작성자와 관리자만 볼 수 있습니다.");
  }
  const file: Attachment | undefined = (post.get("attachments") ?? []).find((item: Attachment) => item.id === fileId);
  if (!file) throw new HttpsError("not-found", "현재 게시글에 없는 파일입니다.");
  const bytes = await readResourceFile(postId, fileId);
  const current = await ref.get();
  if (!current.exists || current.get("revision") !== post.get("revision") || current.get("status") !== post.get("status")) throw new HttpsError("aborted", "게시글이 변경되었습니다. 새로고침해주세요.");
  if (post.get("status") !== "approved") await requireUid(request);
  if (bytes.length !== file.size) throw new HttpsError("data-loss", "파일을 확인하지 못했습니다.");
  return { name: file.name, base64: bytes.toString("base64") };
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
