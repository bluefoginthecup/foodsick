import { Timestamp, type QuerySnapshot } from "firebase-admin/firestore";
import { db } from "./firebase.js";
import type { EvaluationReport } from "./domain/signal-evaluation.js";
export async function scopedInputs(snapshot: QuerySnapshot, now = Date.now()): Promise<EvaluationReport[]> {
  const uids = [...new Set(snapshot.docs.map(d => d.get("ownerUid")).filter((v): v is string => typeof v === "string" && /^[\w-]{1,128}$/.test(v)))];
  const members = new Map<string, Record<string, unknown>>();
  for (let i=0; i<uids.length; i+=100) {
    for (const member of await db.getAll(...uids.slice(i,i+100).map(uid => db.collection("users").doc(uid)))) if (member.exists) members.set(member.id, member.data()!);
  }
  return snapshot.docs.flatMap(doc => {
    const d = doc.data(); const member = members.get(d.ownerUid);
    if (!member || member.status === "deleting") return [];
    const mealAt = d.mealAt instanceof Timestamp ? d.mealAt.toDate().toISOString() : "";
    const onset = d.symptomOnsetAt instanceof Timestamp ? d.symptomOnsetAt.toDate().toISOString() : "";
    if (!mealAt || Date.parse(mealAt)>now || Date.parse(mealAt)<now-365*86400000) return [];
    return [{ id:doc.id, ownerUid:d.ownerUid, canonicalRestaurantId:d.restaurantId, mealAt, symptomOnsetAt:onset,
      foodCategory:d.foodCategory, symptoms:d.symptoms ?? [], partySymptomatic:d.partySymptomatic ?? 0,
      medicalVisit:d.medical?.visited === true, hospitalized:typeof d.medical?.hospitalized === "boolean" ? d.medical.hospitalized : undefined, status:d.status, menu:d.menu ?? "",
      ...(Array.isArray(d.publicMenus) ? {publicMenus:d.publicMenus} : {}), menuReview:d.menuReview ?? null }];
  });
}
