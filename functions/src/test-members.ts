import { createHash, randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin, assertActiveAccount } from "./common.js";
import { db } from "./firebase.js";
import { FOOD_CATEGORIES } from "./domain/report.js";

const options = { region: "asia-northeast3", enforceAppCheck: false };
function batchId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/.test(value)) throw new HttpsError("invalid-argument", "시험 번호를 확인해주세요.");
  return value;
}

export const manageTestMembers = onCall(options, async (request) => {
  const actor = await requireAdmin(request);
  const data = request.data ?? {};
  if (data.action === "batches") {
    const batches = await db.collection("testBatches").orderBy("createdAt", "desc").limit(30).get();
    return { batches: batches.docs.map(d => ({ id: d.id, status: d.get("status"), count: d.get("count"), scenarioVersion: d.get("scenarioVersion") ?? 1, date: d.get("date") })) };
  }
  const id = batchId(data.batchId);
  const batchRef = db.collection("testBatches").doc(id);
  if (data.action === "create") {
    const count = data.count;
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new HttpsError("invalid-argument", "한 번에 1~100명을 생성할 수 있습니다.");
    await db.runTransaction(async tx => {
      const existing = await tx.get(batchRef);
      if (existing.exists) return;
      const date = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      tx.create(batchRef, { status: "active", scenarioVersion: 2, count, date, createdBy: actor, createdAt: FieldValue.serverTimestamp() });
      for (let i = 1; i <= count; i++) {
        tx.create(db.collection("users").doc(`test_${id}_${String(i).padStart(3, "0")}`), {
          nickname: `테스트${String(i).padStart(3, "0")}`, provider: "test", isTest: true, testBatchId: id,
          role: "user", status: "active", identityVerified: false, sessionVersion: randomUUID(),
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
    return { ok: true };
  }
  if (data.action === "list") {
    const [batch, users] = await Promise.all([batchRef.get(), db.collection("users").where("testBatchId", "==", id).get()]);
    // Generated fictional venues are unique to this batch. Never delete shared real venues.
    if (batch.get("status") === "ended" && users.docs.length === 0) {
      const prefix = `manual_test_${id}_`;
      const venues = await db.collection("restaurants").orderBy(FieldPath.documentId()).startAt(prefix).endAt(`${prefix}\uf8ff`).get();
      for (const venue of venues.docs) {
        const remaining = await db.collection("reports").where("restaurantId", "==", venue.id).limit(1).get();
        if (!remaining.empty) continue;
        const cleanup = db.batch();
        cleanup.delete(venue.ref);
        for (const category of FOOD_CATEGORIES) {
          const hash = createHash("sha256").update(`${venue.id}:${category}`).digest("hex");
          cleanup.delete(db.collection("signalPrivacyChecks").doc(hash));
        }
        await cleanup.commit();
      }
    }
    return { status: batch.get("status"), date: batch.get("date"), members: users.docs.map(d => ({ uid: d.id, nickname: d.get("nickname"), status: d.get("status") })).sort((a,b) => a.uid.localeCompare(b.uid)) };
  }
  if (data.action === "token") {
    if (typeof data.uid !== "string" || !data.uid.startsWith(`test_${id}_`) || data.uid.includes("/")) throw new HttpsError("invalid-argument", "테스트 회원을 선택해주세요.");
    const version = await db.runTransaction(async tx => {
      const [batch, user] = await Promise.all([tx.get(batchRef), tx.get(db.collection("users").doc(data.uid))]);
      if (batch.get("status") !== "active" || user.get("isTest") !== true || user.get("testBatchId") !== id || user.get("role") !== "user") throw new HttpsError("permission-denied", "활성 테스트 회원만 접속할 수 있습니다.");
      assertActiveAccount(user, user.get("sessionVersion"));
      tx.update(user.ref, { lastLoginAt: FieldValue.serverTimestamp() });
      return user.get("sessionVersion") as string;
    });
    const customToken = await getAuth().createCustomToken(data.uid, { role: "user", provider: "test", isTest: true, sessionVersion: version });
    return { customToken };
  }
  if (data.action === "end") {
    await db.runTransaction(async tx => {
      const batch = await tx.get(batchRef);
      if (!batch.exists) throw new HttpsError("not-found", "시험을 찾을 수 없습니다.");
      const users = await tx.get(db.collection("users").where("testBatchId", "==", id));
      if (users.docs.some(d => d.get("isTest") !== true || !d.id.startsWith(`test_${id}_`) || d.get("role") !== "user")) throw new HttpsError("failed-precondition", "회원 분류를 확인해주세요.");
      const jobs = await Promise.all(users.docs.map(d => tx.get(db.collection("accountDeletionJobs").doc(d.id))));
      tx.update(batchRef, { status: "ended", endedAt: FieldValue.serverTimestamp() });
      users.docs.forEach((d, i) => {
        tx.update(d.ref, { status: "deleting", updatedAt: FieldValue.serverTimestamp() });
        const job = jobs[i]!;
        if (!job.exists) tx.create(job.ref, { status: "pending", createdAt: FieldValue.serverTimestamp() });
      });
    });
    return { ok: true };
  }
  throw new HttpsError("invalid-argument", "지원하지 않는 작업입니다.");
});
