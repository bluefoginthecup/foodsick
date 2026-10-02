import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db } from "./firebase.js";
import { publicSignalView } from "./domain/public-signal.js";

export const getPublicSignals = onCall({ region: "asia-northeast3", enforceAppCheck: false, maxInstances: 10 }, async (request) => {
  const cursor = request.data?.cursor;
  let query = db.collection("publicSignals").where("validUntil", ">", new Date()).orderBy("validUntil", "desc").orderBy(FieldPath.documentId(), "desc").limit(201);
  if (cursor != null) {
    if (typeof cursor !== "object" || !Number.isSafeInteger(cursor.seconds) || !Number.isSafeInteger(cursor.nanoseconds)
      || cursor.nanoseconds < 0 || cursor.nanoseconds >= 1e9 || typeof cursor.id !== "string" || !/^[a-f0-9]{64}$/.test(cursor.id)) {
      throw new HttpsError("invalid-argument", "조회 위치를 확인해주세요.");
    }
    query = query.startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), cursor.id);
  }
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, 200);
  const last = docs.at(-1);
  const until = last?.get("validUntil") as Timestamp | undefined;
  return {
    signals: docs.flatMap((doc) => { const signal = doc.get("schemaVersion") === 3 ? publicSignalView(doc.data()) : null; return signal ? [signal] : []; }),
    nextCursor: snapshot.size > 200 && last && until ? { id: last.id, seconds: until.seconds, nanoseconds: until.nanoseconds } : null,
  };
});
