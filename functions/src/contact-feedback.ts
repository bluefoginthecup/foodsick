import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { db } from "./firebase.js";

const options = { region: "asia-northeast3", enforceAppCheck: false };
const reasons = new Set(["wrong_phone", "outdated", "wrong_office", "other"]);

function requiredText(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpsError("invalid-argument", `${field} 값을 확인해주세요.`);
  }
  return value.trim();
}

function sourceUrl(value: unknown) {
  const raw = requiredText(value, "출처", 500);
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpsError("invalid-argument", "출처 주소를 확인해주세요."); }
  if (url.protocol !== "https:" || !/(^|\.)(kakao\.com|code\.go\.kr|yongin\.go\.kr)$/.test(url.hostname)) {
    throw new HttpsError("invalid-argument", "허용된 공식 출처가 아닙니다.");
  }
  return url.toString();
}

export const submitContactFeedback = onCall(options, async (request) => {
  const data = request.data as Record<string, unknown>;
  const reason = requiredText(data.reason, "오류 유형", 30);
  if (!reasons.has(reason)) throw new HttpsError("invalid-argument", "오류 유형을 확인해주세요.");
  const phone = requiredText(data.phone, "전화번호", 30);
  if (!/^[+\d()\-\s]{7,30}$/.test(phone)) throw new HttpsError("invalid-argument", "전화번호를 확인해주세요.");

  const now = new Date();
  const requester = request.rawRequest.ip || request.rawRequest.headers["x-forwarded-for"]?.toString() || "unknown";
  const bucket = Math.floor(now.getTime() / 3_600_000);
  const rateId = createHash("sha256").update(`${requester}:${bucket}:contact-feedback`).digest("hex");
  const rateRef = db.collection("rateLimits").doc(rateId);
  const feedbackRef = db.collection("contactFeedback").doc();

  await db.runTransaction(async (transaction) => {
    const rate = await transaction.get(rateRef);
    const count = rate.exists ? Number(rate.get("count")) : 0;
    if (count >= 5) throw new HttpsError("resource-exhausted", "잠시 후 다시 시도해주세요.");
    transaction.set(rateRef, {
      action: "contact-feedback",
      count: count + 1,
      expiresAt: Timestamp.fromMillis(now.getTime() + 2 * 3_600_000),
    }, { merge: true });
    transaction.create(feedbackRef, {
      region: requiredText(data.region, "지역", 120),
      contactKind: requiredText(data.contactKind, "기관 유형", 40),
      contactName: requiredText(data.contactName, "기관명", 120),
      phone,
      sourceUrl: sourceUrl(data.sourceUrl),
      reason,
      note: typeof data.note === "string" ? data.note.trim().slice(0, 300) : "",
      status: "submitted",
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true, feedbackId: feedbackRef.id };
});
