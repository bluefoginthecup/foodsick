import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db } from "./firebase.js";
import { publicSignalView } from "./domain/public-signal.js";
import { publicHistory, type HistoryRow } from "./domain/report-history.js";

export const getPublicReportHistory = onCall({ region: "asia-northeast3", enforceAppCheck: false, maxInstances: 10 }, async () => {
  const snapshot = await db.collection("reportHistoryContributions").where("validUntil", ">", new Date()).limit(1001).get();
  if (snapshot.size > 1000 || snapshot.docs.some(d => d.get("overflow") === true)) throw new HttpsError("resource-exhausted", "전체 신고 이력을 집계하지 못했습니다. 잠시 후 다시 확인해주세요.");
  const rows: HistoryRow[] = snapshot.docs.flatMap(d => d.get("rows") ?? []);
  if (rows.length > 20000) throw new HttpsError("resource-exhausted", "조회할 신고 이력이 너무 많습니다.");
  const oldest = new Date(Date.now() - 365 * 86400000 + 9 * 3600000).toISOString().slice(0,10);
  return { signals: publicHistory(rows.filter(r => r.date >= oldest)), recent: snapshot.docs.flatMap(d => (d.get("recent") ?? []).flatMap((r: Record<string,unknown>) => { const view = publicSignalView(r); return view ? [view] : []; })) };
});

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
