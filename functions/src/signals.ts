import { onCall } from "firebase-functions/v2/https";
import { db } from "./firebase.js";


export const getPublicSignals = onCall({ region: "asia-northeast3", enforceAppCheck: false }, async () => {
  const snapshot = await db.collection("publicSignals").where("publishUntil", ">", new Date()).orderBy("publishUntil", "asc").limit(200).get();
  return {
    signals: snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        displayRegionCode: data.displayRegionCode,
        displayRegion: data.displayRegion,
        displayRegionLevel: data.displayRegionLevel,
        displayCenter: data.displayCenter,
        foodCategory: data.foodCategory,
        independentReportCount: data.independentReportCount,
        companionSymptomaticCount: data.companionSymptomaticCount ?? null,
        medicalVisitReportCount: data.medicalVisitReportCount ?? null,
        windowHours: data.windowHours,
        message: data.message,
        privacyPolicyVersion: data.privacyPolicyVersion,
      };
    }),
  };
});
