"use client";

import { httpsCallable } from "firebase/functions";
import type { ContactFeedback } from "../contact-feedback/contact-feedback-store";
import { getFirebaseClient } from "./client";

export async function submitFirebaseContactFeedback(feedback: Omit<ContactFeedback, "id" | "status" | "createdAt">) {
  const firebase = getFirebaseClient();
  if (!firebase) return false;
  const call = httpsCallable<Record<string, string>, { ok: boolean }>(firebase.functions, "submitContactFeedback");
  const result = await call({
    region: feedback.region,
    contactKind: feedback.contact.kind,
    contactName: feedback.contact.name,
    phone: feedback.contact.phone,
    sourceUrl: feedback.contact.sourceUrl,
    reason: feedback.reason,
    note: feedback.note,
  });
  return result.data.ok;
}
