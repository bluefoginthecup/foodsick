import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAdmin } from "./common.js";
import { db } from "./firebase.js";
import { scopedInputs } from "./signal-inputs.js";
import { evaluateSignals } from "./domain/signal-evaluation.js";
import { type SafeRegion } from "./domain/public-signal.js";
import { validatedPublicMenus } from "./domain/report.js";
import { rebuildRestaurantSignals } from "./signal-publisher.js";
const hash = (v:string) => createHash("sha256").update(v).digest("hex");
export const getAdminVenueSignals = onCall({region:"asia-northeast3", enforceAppCheck:false, secrets:["KAKAO_REST_API_KEY","DEDUPE_HMAC_SECRET"], timeoutSeconds:300}, async request => {
  await requireAdmin(request);
  const {restaurantId}=request.data??{};
  if(typeof restaurantId!=="string"||!/^[\w-]{1,128}$/.test(restaurantId))throw new HttpsError("invalid-argument","조회 조건을 확인해주세요.");
  let verificationFailed=false;
  try{await rebuildRestaurantSignals(restaurantId);}catch{verificationFailed=true;}
  const snapshot = await db.collection("reports").where("restaurantId","==",restaurantId).where("mealAt",">=",Timestamp.fromMillis(Date.now()-365*86400000)).orderBy("mealAt","desc").limit(2001).get();
  if (snapshot.size>2000) throw new HttpsError("resource-exhausted","음식점 조회 한도를 초과했습니다. 부분 결과를 표시하지 않습니다.");
  const inputs = await scopedInputs(snapshot);
  const regions = new Map<string,SafeRegion|null>();
  for (const category of new Set(inputs.map(r=>r.foodCategory))) {
    {
      const check = await db.collection("signalPrivacyChecks").doc(hash(`${restaurantId}:${category}`)).get();
      regions.set(category,!verificationFailed && check.get("expiresAt")?.toMillis()>Date.now() ? check.get("region") ?? null : null);
    }
  }
  const evaluated = evaluateSignals(inputs,regions,id=>hash(id));
  const included = new Set(inputs.map(r=>r.id));
  return {...evaluated, ...(verificationFailed ? {reason:"장소 확인 또는 재집계 실패: 원본 신고만 표시합니다. 다시 조회해주세요."} : {}), fixture:null, reports:snapshot.docs.filter(d=>included.has(d.id)).map(doc=>{
    const d=doc.data(); return {id:doc.id,ownerUid:d.ownerUid,status:d.status,draft:d.draft,publicMenus:d.publicMenus ?? null,menuReview:d.menuReview ?? null,incubationMinutes:d.incubationMinutes ?? null,sensitiveDataConsentVersion:d.sensitiveDataConsentVersion ?? "",createdAt:d.createdAt?.toDate?.().toISOString() ?? "",updatedAt:d.updatedAt?.toDate?.().toISOString() ?? ""};
  })};
});
export const reviewPublicMenus = onCall({region:"asia-northeast3",enforceAppCheck:false},async request=>{
  const actorUid=await requireAdmin(request);
  const {reportId, menus, expectedUpdatedAt}=request.data ?? {};
  if(typeof reportId!=="string" || !/^[\w-]{1,128}$/.test(reportId) || typeof expectedUpdatedAt!=="string") throw new HttpsError("invalid-argument","신고를 확인해주세요.");
  let safe:string[];
  try { safe=validatedPublicMenus(menus); } catch {throw new HttpsError("invalid-argument","메뉴를 목록에서 선택해주세요.");}
  await db.runTransaction(async tx=>{
    const ref=db.collection("reports").doc(reportId); const doc=await tx.get(ref);
    if(!doc.exists) throw new HttpsError("not-found","신고가 없습니다.");
    if(doc.get("updatedAt")?.toDate?.().toISOString()!==expectedUpdatedAt) throw new HttpsError("aborted","신고가 변경됐습니다. 새로고침해주세요.");
    tx.update(ref,{menuReview:{menus:safe,actorUid},updatedAt:FieldValue.serverTimestamp()});
    tx.create(db.collection("adminAuditLogs").doc(),{actorUid,ownerUid:doc.get("ownerUid"),reportId,action:"public_menu_review",menus:safe,createdAt:FieldValue.serverTimestamp()});
  });
  return {ok:true};
});
