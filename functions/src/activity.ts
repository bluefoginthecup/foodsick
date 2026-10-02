import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { db } from "./firebase.js";
export function recordActivity(transaction: Transaction, uid: string, action: string, reportId?: string, actorUid?: string) {
  transaction.create(db.collection("memberActivities").doc(), {
    ownerUid: uid, action, ...(reportId ? { reportId } : {}), ...(actorUid ? { actorUid } : {}), createdAt: FieldValue.serverTimestamp(),
  });
}
