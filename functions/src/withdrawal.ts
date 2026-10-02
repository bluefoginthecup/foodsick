import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { requireUid, assertActiveAccount } from "./common.js";
import { db } from "./firebase.js";

export const withdrawMyAccount = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  const uid = await requireUid(request);
  if (request.data?.confirmation !== "탈퇴") throw new HttpsError("invalid-argument", "탈퇴 확인 문구를 입력해주세요.");
  await db.runTransaction(async (transaction) => {
    const ref = db.collection("users").doc(uid);
    assertActiveAccount(await transaction.get(ref), request.auth?.token.sessionVersion);
    transaction.update(ref, { status: "deleting", updatedAt: FieldValue.serverTimestamp() });
    transaction.set(db.collection("accountDeletionJobs").doc(uid), { status: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  return { accepted: true };
});

export async function eraseAccount(uid: string) {
  // The account is already locked. Retries can safely resume after any batch.
  try { await getAuth().updateUser(uid, { disabled: true }); await getAuth().revokeRefreshTokens(uid); }
  catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
  for (const [collection, field] of [["reports", "ownerUid"], ["companionObservations", "ownerUid"], ["dedupeKeys", "ownerUid"], ["rateLimits", "uid"], ["kakaoAuthExchanges", "uid"], ["memberActivities", "ownerUid"]] as const) {
    while (true) {
      const page = await db.collection(collection).where(field, "==", uid).limit(400).get();
      if (!page.size) break;
      const batch = db.batch();
      page.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }
  // Each report deletion also triggers privacy-safe public signal recalculation.
  try { await getAuth().deleteUser(uid); }
  catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
  await db.runTransaction(async (transaction) => {
    transaction.delete(db.collection("users").doc(uid));
    transaction.delete(db.collection("accountDeletionJobs").doc(uid));
  });
}

export const processAccountWithdrawal = onDocumentCreated({ document: "accountDeletionJobs/{uid}", region: "asia-northeast3", timeoutSeconds: 540, retry: true, maxInstances: 1, concurrency: 1 }, async (event) => {
  if (!event.data) return;
  const uid = event.params.uid;
  // Ignore completed jobs if Eventarc redelivers an old creation event.
  const job = await db.collection("accountDeletionJobs").doc(uid).get();
  if (!job.exists || !job.createTime?.isEqual(event.data.createTime)) return;
  try { await eraseAccount(uid); }
  catch (error) {
    await db.collection("accountDeletionJobs").doc(uid).set({ status: "retrying", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});
