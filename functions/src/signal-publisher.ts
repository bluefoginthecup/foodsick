import { createHash, createHmac } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, type QuerySnapshot } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebase.js";
import { buildClusterCandidates } from "./domain/clustering.js";
import { type SafeRegion } from "./domain/public-signal.js";
import { kakaoClient, verifyVenuePrivacy } from "./domain/venue-privacy.js";

import { registeredVenueEvidence } from "./venue-evidence.js";
import { scopedInputs } from "./signal-inputs.js";
import { evaluateSignals } from "./domain/signal-evaluation.js";
import { historyRows } from "./domain/report-history.js";

const kakaoSecret = defineSecret("KAKAO_REST_API_KEY");
const idSecret = defineSecret("DEDUPE_HMAC_SECRET");
const YEAR = 365 * 86400_000;
const PRIVACY_TTL = 24 * 3600_000;
const MAX_REPORTS = 2000;
const MAX_CLUSTERS = 150;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const fingerprint = (snapshot: QuerySnapshot) => hash(snapshot.docs.map((doc) => `${doc.id}:${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}`).sort().join("|"));
export async function rebuildRestaurantSignals(restaurantId: string) {
  if (!restaurantId || restaurantId.includes("/")) return;
  const now = Date.now();
  const query = db.collection("reports").where("restaurantId", "==", restaurantId)
    .where("mealAt", ">=", Timestamp.fromMillis(now - YEAR)).orderBy("mealAt", "desc").limit(MAX_REPORTS + 1);
  const snapshot = await query.get();
  const signature = fingerprint(snapshot);
  const inputs = await scopedInputs(snapshot, now);
  const candidates = snapshot.size > MAX_REPORTS ? [] : buildClusterCandidates(inputs);
  const overflow = snapshot.size > MAX_REPORTS || candidates.length > MAX_CLUSTERS;
  const safeCandidates = overflow ? [] : candidates;
  const regions = new Map<string, { region: SafeRegion | null; expiresAt: Timestamp }>();
  let verificationFailed = false;
  for (const category of new Set((overflow ? [] : inputs).map((item) => item.foodCategory))) {
    const cacheRef = db.collection("signalPrivacyChecks").doc(hash(`${restaurantId}:${category}`));
    const registered = await registeredVenueEvidence(restaurantId,category);
    if(registered !== undefined){
      const expiresAt=Timestamp.fromMillis(now+PRIVACY_TTL);
      await cacheRef.set({region:registered,expiresAt,checkedAt:FieldValue.serverTimestamp()});
      regions.set(category,{region:registered,expiresAt});continue;
    }
    const cached = await cacheRef.get();
    const cachedData = cached.data();
    if (cachedData?.expiresAt instanceof Timestamp && cachedData.expiresAt.toMillis() > now) {
      regions.set(category, { region: cachedData.region ?? null, expiresAt: cachedData.expiresAt });
      continue;
    }
    const source = snapshot.docs.find((doc) => doc.get("foodCategory") === category)?.data();
    const hint = [source?.region?.province, source?.region?.city].filter(Boolean).join(" ");
    try {
      const region = await verifyVenuePrivacy(restaurantId, String(source?.draft?.restaurantDisplayInput ?? ""), hint, category, kakaoClient(kakaoSecret.value()));
      const expiresAt = Timestamp.fromMillis(now + PRIVACY_TTL);
      await cacheRef.set({ region, expiresAt, checkedAt: FieldValue.serverTimestamp() });
      regions.set(category, { region, expiresAt });
    } catch (error) {
      verificationFailed = true;
      console.error("Signal privacy verification unavailable", error instanceof Error ? error.message : "unknown");
    }
  }

  const stateRef = db.collection("signalPublicationState").doc(hash(restaurantId));
  const evaluated = evaluateSignals(overflow ? [] : inputs, new Map([...regions].map(([key,value]) => [key,value.region])), candidateId => createHmac("sha256", idSecret.value()).update(`signal-v1:${candidateId}`).digest("hex"));
  const today = new Date(now + 9 * 3600000).toISOString().slice(0,10);
  const recentStart = Date.parse(`${today}T00:00:00+09:00`) - 6 * 86400000;
  const recent = evaluateSignals(overflow ? [] : inputs.filter(r => Date.parse(r.mealAt) >= recentStart), new Map([...regions].map(([key,value]) => [key,value.region])), candidateId => createHmac("sha256", idSecret.value()).update(`recent-v1:${candidateId}`).digest("hex")).signals;
  const publications = evaluated.signals.map(signal => ({ ...signal,
    validUntil: Timestamp.fromMillis(Math.min(regions.get(signal.category)!.expiresAt.toMillis(), Date.parse(`${signal.observedAt}T00:00:00+09:00`) + YEAR)),
    generatedAt: FieldValue.serverTimestamp(), schemaVersion: 3,
  }));

  await db.runTransaction(async (transaction) => {
    const [current, previous] = await Promise.all([transaction.get(query), transaction.get(stateRef)]);
    if (fingerprint(current) !== signature) throw new Error("Reports changed during publication; retry required");
    const nextIds = new Set(publications.map((item) => item.id));
    const previousIds: string[] = previous.get("publicIds") ?? [];
    for (const id of previousIds) if (!nextIds.has(id)) transaction.delete(db.collection("publicSignals").doc(id));
    for (const publication of publications) transaction.set(db.collection("publicSignals").doc(publication.id), publication);
    transaction.set(db.collection("reportHistoryContributions").doc(hash(restaurantId)), {
      rows: historyRows(overflow ? [] : inputs, new Map([...regions].map(([key,value]) => [key,value.region]))),
      recent,
      validUntil: Timestamp.fromMillis(Math.min(now + PRIVACY_TTL, ...[...regions.values()].map(r => r.expiresAt.toMillis()))),
      updatedAt: FieldValue.serverTimestamp(), overflow,
    });
    transaction.set(stateRef, {
      restaurantId, publicIds: [...nextIds], reportFingerprint: signature,
      status: overflow ? "capacity_review_required" : verificationFailed ? "verification_retry" : publications.length ? "published" : "below_publication_threshold",
      candidates: safeCandidates, updatedAt: FieldValue.serverTimestamp(), ruleVersion: "cluster-v1",
    });
  });
  // Old public records have already been withdrawn before requesting a retry.
  if (verificationFailed) throw new Error("Privacy verification failed; public signals withdrawn pending retry");
}

export const syncReportSignals = onDocumentWritten({
  document: "reports/{reportId}", region: "asia-northeast3", retry: true,
  secrets: [kakaoSecret, idSecret], timeoutSeconds: 300, maxInstances: 5,
}, async (event) => {
  const ids = new Set([event.data?.before.get("restaurantId"), event.data?.after.get("restaurantId")]);
  // Rebuild both sides when a reporter changes the restaurant, including deletions.
  for (const id of ids) if (typeof id === "string") await rebuildRestaurantSignals(id);
});

// Recovery/backfill and refreshed venue evidence, independent of browser visits.
export const reconcilePublicSignals = onSchedule({
  schedule: "every 6 hours", timeZone: "Asia/Seoul", region: "asia-northeast3",
  secrets: [kakaoSecret, idSecret], timeoutSeconds: 540, maxInstances: 1, retryCount: 1,
}, async () => {
  const progress = db.collection("signalJobs").doc("reconcile");
  const cursor = (await progress.get()).get("cursor");
  let query = db.collection("restaurants").orderBy(FieldPath.documentId()).limit(100);
  if (typeof cursor === "string" && cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  let lastId = "";
  const started = Date.now();
  let failed = 0;
  for (const restaurant of snapshot.docs) {
    try { await rebuildRestaurantSignals(restaurant.id); }
    catch (error) { failed++; console.error("Signal reconciliation needs retry", error instanceof Error ? error.message : "unknown"); }
    lastId = restaurant.id;
    if (Date.now() - started > 450_000) break;
  }
  const completedPage = lastId === snapshot.docs.at(-1)?.id;
  await progress.set({ cursor: completedPage && snapshot.size < 100 ? "" : lastId, updatedAt: FieldValue.serverTimestamp(), failed });
});
