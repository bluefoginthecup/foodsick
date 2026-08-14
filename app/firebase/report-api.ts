"use client";

import { httpsCallable } from "firebase/functions";
import type { ReportDraft, ReportStatus } from "../contracts";
import { getFirebaseClient } from "./client";

type ReportOutcome = { outcome: "created" | "duplicate" | "updated"; reportId: string };
type PublicSignalResponse = { signals: Array<Record<string, unknown>> };
export type FirebaseStoredReport = {
  id: string;
  ownerUid: string;
  status: ReportStatus;
  draft: ReportDraft;
  incubationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

function functionsClient() {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error("Firebase 연결 설정이 완료되지 않았습니다.");
  return firebase.functions;
}

function reportPayload(draft: ReportDraft) {
  return { ...draft, sensitiveDataConsentVersion: "consent-v1" };
}

export async function submitFirebaseReport(draft: ReportDraft) {
  const call = httpsCallable<ReturnType<typeof reportPayload>, ReportOutcome>(functionsClient(), "submitReport");
  return (await call(reportPayload(draft))).data;
}

export async function updateFirebaseReport(reportId: string, draft: ReportDraft) {
  const call = httpsCallable<{ reportId: string; report: ReturnType<typeof reportPayload> }, ReportOutcome>(functionsClient(), "updateReport");
  return (await call({ reportId, report: reportPayload(draft) })).data;
}

export async function getFirebaseReports() {
  const call = httpsCallable<Record<string, never>, { reports: FirebaseStoredReport[] }>(functionsClient(), "getMyReports");
  return (await call({})).data.reports;
}

export async function getFirebasePublicSignals() {
  const call = httpsCallable<Record<string, never>, PublicSignalResponse>(functionsClient(), "getPublicSignals");
  return (await call({})).data.signals;
}

export async function setFirebaseReportStatus(reportId: string, status: ReportStatus, note: string) {
  const call = httpsCallable<{ reportId: string; status: ReportStatus; note: string }, { ok: boolean }>(functionsClient(), "setReportStatus");
  return (await call({ reportId, status, note })).data.ok;
}
