"use client";

import { httpsCallable } from "firebase/functions";
import type { ReportDraft, ReportStatus } from "../contracts";
import { getFirebaseClient } from "./client";
import { parsePublicSignals, type PublicSignal } from "../public-signals";

type ReportOutcome = { outcome: "created" | "duplicate" | "updated"; reportId: string };
type SignalCursor = { id: string; seconds: number; nanoseconds: number };
type PublicSignalResponse = { signals: unknown; nextCursor?: SignalCursor | null };
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

export type AdminReport = Omit<FirebaseStoredReport, "draft"> & { draft: ReportDraft | null; sensitiveDataConsentVersion?: string };
export async function getFirebaseAdminReports(cursor?: string, ownerUid?: string) {
  const call = httpsCallable<{ cursor?: string; ownerUid?: string }, { reports: AdminReport[]; nextCursor: string | null }>(functionsClient(), "getAdminReports");
  return (await call({ ...(cursor ? { cursor } : {}), ...(ownerUid ? { ownerUid } : {}) })).data;
}

export type AdminMember = { uid: string; nickname: string; status: "active" | "deleting"; provider: string; role: "admin" | "user"; createdAt: string; lastLoginAt: string; reportCount: number };
export async function getFirebaseAdminMembers(search = "", cursor?: string) {
  const call = httpsCallable<{ search: string; cursor?: string }, { members: AdminMember[]; nextCursor: string | null }>(functionsClient(), "getAdminMembers");
  return (await call({ search, ...(cursor ? { cursor } : {}) })).data;
}

export async function getFirebasePublicSignals() {
  const call = httpsCallable<{ cursor?: SignalCursor }, PublicSignalResponse>(functionsClient(), "getPublicSignals");
  const signals = new Map<string, PublicSignal>();
  let cursor: SignalCursor | undefined;
  for (let page = 0; page < 50; page++) {
    const { data } = await call(cursor ? { cursor } : {});
    for (const signal of parsePublicSignals(data.signals)) signals.set(signal.id, signal);
    if (!data.nextCursor) return [...signals.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    cursor = data.nextCursor;
  }
  throw new Error("신호가 많아 전체 조회를 마치지 못했습니다. 잠시 후 다시 시도해주세요.");
}

export async function getFirebaseReportHistory() {
  const call = httpsCallable<Record<string,never>, {signals:unknown[];recent:unknown[]}>(functionsClient(), "getPublicReportHistory");
  const {data} = await call({});
  return {signals:parsePublicSignals(data.signals, true),recent:parsePublicSignals(data.recent)};
}

export async function setFirebaseReportStatus(reportId: string, status: ReportStatus, note: string) {
  const call = httpsCallable<{ reportId: string; status: ReportStatus; note: string }, { ok: boolean }>(functionsClient(), "setReportStatus");
  return (await call({ reportId, status, note })).data.ok;
}

export type MemberActivity = { id: string; action: string; reportId: string | null; actorUid: string | null; createdAt: string };
export async function getFirebaseMemberActivities(uid: string, cursor?: string) {
  const call = httpsCallable<{ uid: string; cursor?: string }, { activities: MemberActivity[]; nextCursor: string | null }>(functionsClient(), "getMemberActivities");
  return (await call({ uid, ...(cursor ? { cursor } : {}) })).data;
}
export async function deleteFirebaseReport(reportId: string) {
  return (await httpsCallable<{ reportId: string }, { ok: boolean }>(functionsClient(), "deleteMyReport")({ reportId })).data.ok;
}
