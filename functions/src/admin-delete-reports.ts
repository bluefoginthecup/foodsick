import { FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin, assertActiveAccount } from "./common.js";
import { db } from "./firebase.js";
import { createDedupeKey } from "./domain/keys.js";
import { recordActivity } from "./activity.js";

const secret = defineSecret("DEDUPE_HMAC_SECRET");
type Target = { source: "symptom" | "cdc"; id: string; updatedAt: string; revision: number };
export const deleteAdminReports = onCall({ region: "asia-northeast3", enforceAppCheck: false, secrets: [secret], timeoutSeconds: 120 }, async request => {
  const actorUid = await requireAdmin(request);
  const targets = request.data?.reports as Target[];
  if (request.data?.confirmation !== "삭제" || !Array.isArray(targets) || !targets.length || targets.length > 25
    || targets.some(r => !r || !["symptom", "cdc"].includes(r.source) || typeof r.id !== "string" || !/^[\w-]{1,128}$/.test(r.id)
      || typeof r.updatedAt !== "string" || (r.updatedAt !== "" && !Number.isFinite(Date.parse(r.updatedAt))) || !Number.isSafeInteger(r.revision) || r.revision < 0)
    || new Set(targets.map(r => `${r.source}:${r.id}`)).size !== targets.length) throw new HttpsError("invalid-argument", "삭제할 신고와 확인 문구를 확인해주세요.");
  return db.runTransaction(async tx => {
    assertActiveAccount(await tx.get(db.collection("users").doc(actorUid)), request.auth?.token.sessionVersion);
    const records = await Promise.all(targets.map(async target => {
      const ref = db.collection(target.source === "cdc" ? "cdcReports" : "reports").doc(target.id);
      const doc = await tx.get(ref);
      if (doc.exists && ((doc.get("updatedAt")?.toDate?.().toISOString() ?? "") !== target.updatedAt || (doc.get("revision") ?? 0) !== target.revision)) {
        throw new HttpsError("aborted", "조회 후 변경된 신고가 있습니다. 자료를 새로고침한 뒤 다시 선택해주세요.");
      }
      const dedupe = doc.exists && target.source === "symptom" ? db.collection("dedupeKeys").doc(createDedupeKey(secret.value(), String(doc.get("ownerUid")), String(doc.get("restaurantId")), String(doc.get("mealDateLocal")))) : null;
      const key = dedupe ? await tx.get(dedupe) : null;
      return { target, ref, doc, dedupe, key };
    }));
    let deleted = 0;
    for (const { target, ref, doc, dedupe, key } of records) {
      if (!doc.exists) continue;
      if (dedupe && key?.get("reportId") === target.id) tx.delete(dedupe);
      if (target.source === "symptom") tx.delete(db.collection("companionObservations").doc(target.id));
      tx.delete(ref);
      recordActivity(tx, String(doc.get("ownerUid")), target.source === "cdc" ? "cdc_report_deleted" : "report_deleted", target.id);
      deleted++;
    }
    // Store identifiers and actor only; deleted health details are not copied to logs.
    tx.set(db.collection("adminAuditLogs").doc(), { actorUid, action: "reports_deleted", targets: targets.map(({ source, id }) => ({ source, id })), deleted, createdAt: FieldValue.serverTimestamp() });
    // Existing report deletion trigger recalculates public signals, including threshold withdrawal.
    return { deleted, processed: targets.map(({ source, id }) => `${source}:${id}`) };
  });
});
