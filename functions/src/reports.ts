import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin, requireUid } from "./common.js";
import { createDedupeKey, rateLimitBucket } from "./domain/keys.js";
import { InputError, validateReportInput } from "./domain/report.js";
import { db } from "./firebase.js";

const dedupeSecret = defineSecret("DEDUPE_HMAC_SECRET");
const callableOptions = { region: "asia-northeast3", enforceAppCheck: false, secrets: [dedupeSecret] };

function reportDocument(ownerUid: string, report: ReturnType<typeof validateReportInput>, updatedAt: FieldValue) {
  return {
    ownerUid,
    restaurantId: report.restaurantInternalId,
    mealAt: Timestamp.fromDate(report.mealAt),
    mealDateLocal: report.mealDate,
    timezone: "Asia/Seoul",
    region: { province: report.province, city: report.city, district: report.district },
    foodCategory: report.foodCategory,
    menu: report.menu,
    serviceMode: report.serviceMode,
    symptoms: report.symptoms,
    diarrheaCount: report.diarrheaCount,
    otherSymptom: report.otherSymptom,
    symptomOnsetAt: Timestamp.fromDate(report.symptomOnsetAt),
    incubationMinutes: report.incubationMinutes,
    medical: {
      visited: report.medicalVisit,
      hospitalized: report.hospitalized,
      tested: report.tested,
      pathogenKnown: report.pathogenKnown,
      pathogenType: report.pathogenType || null,
      medicalVisitVerified: false,
      pathogenVerified: false,
      evidenceVerified: false,
    },
    partyTotal: report.partyTotal,
    partySymptomatic: report.partySymptomatic,
    sensitiveDataConsentVersion: report.sensitiveDataConsentVersion,
    draft: {
      mealDate: report.mealDate,
      mealTime: report.mealTime,
      province: report.province,
      city: report.city,
      district: report.district,
      restaurantInternalId: report.restaurantInternalId,
      restaurantDisplayInput: report.restaurantDisplayInput,
      foodCategory: report.foodCategory,
      menu: report.menu,
      serviceMode: report.serviceMode,
      symptoms: report.symptoms,
      diarrheaCount: report.diarrheaCount,
      otherSymptom: report.otherSymptom,
      onsetDate: report.onsetDate,
      onsetTime: report.onsetTime,
      partyTotal: report.partyTotal,
      partySymptomatic: report.partySymptomatic,
      companionSymptoms: report.companionSymptoms,
      companionOnsetAt: report.companionOnsetAt,
      companionMedicalVisit: report.companionMedicalVisit,
      companionTested: report.companionTested,
      medicalVisit: report.medicalVisit,
      hospitalized: report.hospitalized,
      tested: report.tested,
      pathogenKnown: report.pathogenKnown,
      pathogenType: report.pathogenType,
    },
    schemaVersion: 1,
    updatedAt,
  };
}

function timestampIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();
}

function companionDocument(ownerUid: string, reportId: string, report: ReturnType<typeof validateReportInput>, updatedAt: FieldValue) {
  return {
    reportId,
    ownerUid,
    affectedCount: report.partySymptomatic,
    symptoms: report.companionSymptoms,
    onsetAt: report.companionOnsetAt ? Timestamp.fromDate(new Date(`${report.companionOnsetAt}:00+09:00`)) : null,
    medicalVisit: report.companionMedicalVisit,
    tested: report.companionTested,
    source: "reporter_entered",
    linkedReportId: null,
    verificationStatus: "unverified",
    updatedAt,
  };
}

function inputError(error: unknown): never {
  if (error instanceof InputError) throw new HttpsError("invalid-argument", error.message, { field: error.field });
  if (error instanceof HttpsError) throw error;
  throw new HttpsError("internal", "신고를 처리하지 못했습니다.");
}

function rateLimitId(uid: string, action: string, now: Date) {
  return createHash("sha256").update(`${uid}:${action}:${rateLimitBucket(now, 60)}`).digest("hex");
}

export const submitReport = onCall(callableOptions, async (request) => {
  try {
    const ownerUid = requireUid(request);
    const report = validateReportInput(request.data);
    const now = new Date();
    const key = createDedupeKey(dedupeSecret.value(), ownerUid, report.restaurantInternalId, report.mealDate);
    const dedupeRef = db.collection("dedupeKeys").doc(key);
    const rateRef = db.collection("rateLimits").doc(rateLimitId(ownerUid, "report-create", now));
    const restaurantRef = db.collection("restaurants").doc(report.restaurantInternalId);
    const reportRef = db.collection("reports").doc();
    const companionRef = db.collection("companionObservations").doc(reportRef.id);

    return await db.runTransaction(async (transaction) => {
      const [dedupeSnapshot, rateSnapshot, restaurantSnapshot] = await Promise.all([
        transaction.get(dedupeRef),
        transaction.get(rateRef),
        transaction.get(restaurantRef),
      ]);
      if (dedupeSnapshot.exists) {
        return { outcome: "duplicate" as const, reportId: dedupeSnapshot.get("reportId") as string };
      }
      const currentCount = rateSnapshot.exists ? Number(rateSnapshot.get("count")) : 0;
      if (currentCount >= 5) throw new HttpsError("resource-exhausted", "잠시 후 다시 시도해주세요.");
      if (restaurantSnapshot.exists && restaurantSnapshot.get("status") === "blocked") {
        throw new HttpsError("failed-precondition", "음식점 정보를 다시 선택해주세요.");
      }
      const serverTimestamp = FieldValue.serverTimestamp();
      if (!restaurantSnapshot.exists) {
        transaction.create(restaurantRef, {
          canonicalName: report.restaurantDisplayInput,
          region: { province: report.province, city: report.city, district: report.district },
          status: "pending_match",
          source: report.restaurantInternalId.startsWith("manual_") ? "reporter_entered" : "app_matcher",
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        });
      }
      transaction.set(rateRef, { uid: ownerUid, action: "report-create", count: currentCount + 1, expiresAt: Timestamp.fromMillis(now.getTime() + 60 * 60_000) }, { merge: true });
      transaction.create(reportRef, {
        ...reportDocument(ownerUid, report, serverTimestamp),
        status: "submitted",
        createdAt: serverTimestamp,
      });
      if (report.partySymptomatic > 0) {
        transaction.create(companionRef, {
          ...companionDocument(ownerUid, reportRef.id, report, serverTimestamp),
          createdAt: serverTimestamp,
        });
      }
      transaction.create(dedupeRef, { ownerUid, restaurantId: report.restaurantInternalId, mealDate: report.mealDate, reportId: reportRef.id, version: 1, createdAt: serverTimestamp });
      return { outcome: "created" as const, reportId: reportRef.id };
    });
  } catch (error) {
    inputError(error);
  }
});

export const updateReport = onCall(callableOptions, async (request) => {
  try {
    const ownerUid = requireUid(request);
    const envelope = request.data as { reportId?: unknown; report?: unknown };
    const reportId = typeof envelope.reportId === "string" ? envelope.reportId : "";
    if (!reportId) throw new InputError("reportId", "수정할 신고를 확인해주세요.");
    const report = validateReportInput(envelope.report);
    const reportRef = db.collection("reports").doc(reportId);
    const companionRef = db.collection("companionObservations").doc(reportId);
    const restaurantRef = db.collection("restaurants").doc(report.restaurantInternalId);
    const newKey = createDedupeKey(dedupeSecret.value(), ownerUid, report.restaurantInternalId, report.mealDate);
    const newDedupeRef = db.collection("dedupeKeys").doc(newKey);
    const rateRef = db.collection("rateLimits").doc(rateLimitId(ownerUid, "report-update", new Date()));

    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(reportRef);
      if (!currentSnapshot.exists || currentSnapshot.get("ownerUid") !== ownerUid) throw new HttpsError("not-found", "수정할 신고를 찾을 수 없습니다.");
      if (currentSnapshot.get("status") === "rejected") throw new HttpsError("failed-precondition", "집계 제외된 신고는 수정할 수 없습니다.");
      const oldRestaurantId = String(currentSnapshot.get("restaurantId"));
      const oldMealDate = String(currentSnapshot.get("mealDateLocal"));
      const oldKey = createDedupeKey(dedupeSecret.value(), ownerUid, oldRestaurantId, oldMealDate);
      const oldDedupeRef = db.collection("dedupeKeys").doc(oldKey);
      const [restaurantSnapshot, newDedupeSnapshot, rateSnapshot] = await Promise.all([
        transaction.get(restaurantRef),
        transaction.get(newDedupeRef),
        transaction.get(rateRef),
      ]);
      if (restaurantSnapshot.exists && restaurantSnapshot.get("status") === "blocked") throw new HttpsError("failed-precondition", "음식점 정보를 다시 선택해주세요.");
      if (newDedupeSnapshot.exists && newDedupeSnapshot.get("reportId") !== reportId) throw new HttpsError("already-exists", "이미 같은 식사 신고가 있습니다.", { reportId: newDedupeSnapshot.get("reportId") });
      const currentCount = rateSnapshot.exists ? Number(rateSnapshot.get("count")) : 0;
      if (currentCount >= 20) throw new HttpsError("resource-exhausted", "수정 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      const serverTimestamp = FieldValue.serverTimestamp();
      if (!restaurantSnapshot.exists) {
        transaction.create(restaurantRef, {
          canonicalName: report.restaurantDisplayInput,
          region: { province: report.province, city: report.city, district: report.district },
          status: "pending_match",
          source: report.restaurantInternalId.startsWith("manual_") ? "reporter_entered" : "app_matcher",
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        });
      }
      transaction.set(rateRef, { uid: ownerUid, action: "report-update", count: currentCount + 1, expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60_000) }, { merge: true });
      transaction.update(reportRef, reportDocument(ownerUid, report, serverTimestamp));
      if (report.partySymptomatic > 0) transaction.set(companionRef, companionDocument(ownerUid, reportId, report, serverTimestamp), { merge: true });
      else transaction.delete(companionRef);
      if (oldKey !== newKey) transaction.delete(oldDedupeRef);
      transaction.set(newDedupeRef, { ownerUid, restaurantId: report.restaurantInternalId, mealDate: report.mealDate, reportId, version: 1, updatedAt: serverTimestamp }, { merge: true });
    });
    return { outcome: "updated" as const, reportId };
  } catch (error) {
    inputError(error);
  }
});

export const getMyReports = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  const ownerUid = requireUid(request);
  const snapshot = await db.collection("reports").where("ownerUid", "==", ownerUid).orderBy("createdAt", "desc").limit(50).get();
  return { reports: snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ownerUid,
      status: data.status,
      draft: data.draft,
      incubationMinutes: data.incubationMinutes ?? null,
      createdAt: timestampIso(data.createdAt),
      updatedAt: timestampIso(data.updatedAt),
    };
  }) };
});

export const setReportStatus = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async (request) => {
  const actorUid = requireAdmin(request);
  const data = request.data as { reportId?: unknown; status?: unknown; note?: unknown };
  const reportId = typeof data.reportId === "string" ? data.reportId : "";
  const status = typeof data.status === "string" ? data.status : "";
  const note = typeof data.note === "string" ? data.note.slice(0, 300) : "";
  const allowed = ["duplicate_suspected", "reviewed", "included_in_cluster", "rejected"];
  if (!reportId || !allowed.includes(status)) throw new HttpsError("invalid-argument", "상태 변경값을 확인해주세요.");
  const reportRef = db.collection("reports").doc(reportId);
  const auditRef = db.collection("adminAuditLogs").doc();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reportRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "신고를 찾을 수 없습니다.");
    transaction.update(reportRef, { status, updatedAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, { actorUid, action: "report_status_changed", reportId, before: snapshot.get("status"), after: status, note, createdAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});
