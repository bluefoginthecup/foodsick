"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ReportDraft, ReportStatus } from "../contracts";
import { canTransitionReport } from "../security/policy";

export type StoredReport = {
  id: string;
  ownerUid: string;
  dedupeKey: string;
  status: ReportStatus;
  draft: ReportDraft;
  incubationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuditEvent = {
  id: string;
  actorUid: string;
  action: "report_status_changed";
  reportId: string;
  before: ReportStatus;
  after: ReportStatus;
  note: string;
  createdAt: string;
};

type CreateResult =
  | { kind: "created"; report: StoredReport }
  | { kind: "duplicate"; report: StoredReport };

type ReportStoreValue = {
  reports: StoredReport[];
  createReport: (ownerUid: string, draft: ReportDraft) => CreateResult;
  updateReport: (reportId: string, ownerUid: string, draft: ReportDraft) => StoredReport | null;
  getReport: (reportId: string) => StoredReport | undefined;
  auditEvents: AdminAuditEvent[];
  setReportStatus: (actorUid: string, reportId: string, status: ReportStatus, note: string) => boolean;
};

const ReportStore = createContext<ReportStoreValue | null>(null);
const SESSION_REPORTS_KEY = "foodsick.demo-reports";
const SESSION_AUDIT_KEY = "foodsick.demo-audit-events";

export function makeDedupeKey(ownerUid: string, restaurantInternalId: string, mealDate: string) {
  return [ownerUid, restaurantInternalId, mealDate].map((part) => part.trim().toLocaleLowerCase("ko-KR")).join("|");
}

function calculateIncubationMinutes(draft: ReportDraft) {
  if (!draft.mealDate || !draft.mealTime || !draft.onsetDate || !draft.onsetTime) return null;
  const mealAt = new Date(`${draft.mealDate}T${draft.mealTime}:00+09:00`).getTime();
  const onsetAt = new Date(`${draft.onsetDate}T${draft.onsetTime}:00+09:00`).getTime();
  const minutes = Math.round((onsetAt - mealAt) / 60000);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

export function ReportStoreProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
  const [sessionRestored, setSessionRestored] = useState(false);

  /* Session storage is client-only, so restoration must happen after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const storedReports = window.sessionStorage.getItem(SESSION_REPORTS_KEY);
      const storedAuditEvents = window.sessionStorage.getItem(SESSION_AUDIT_KEY);
      if (storedReports) {
        const parsed = JSON.parse(storedReports) as unknown;
        if (Array.isArray(parsed)) setReports(parsed as StoredReport[]);
      }
      if (storedAuditEvents) {
        const parsed = JSON.parse(storedAuditEvents) as unknown;
        if (Array.isArray(parsed)) setAuditEvents(parsed as AdminAuditEvent[]);
      }
    } catch {
      window.sessionStorage.removeItem(SESSION_REPORTS_KEY);
      window.sessionStorage.removeItem(SESSION_AUDIT_KEY);
    } finally {
      setSessionRestored(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!sessionRestored) return;
    window.sessionStorage.setItem(SESSION_REPORTS_KEY, JSON.stringify(reports));
    window.sessionStorage.setItem(SESSION_AUDIT_KEY, JSON.stringify(auditEvents));
  }, [auditEvents, reports, sessionRestored]);

  const value = useMemo<ReportStoreValue>(() => ({
    reports,
    auditEvents,
    createReport(ownerUid, draft) {
      const dedupeKey = makeDedupeKey(ownerUid, draft.restaurantInternalId, draft.mealDate);
      const duplicate = reports.find((report) => report.dedupeKey === dedupeKey && report.status !== "rejected");
      if (duplicate) return { kind: "duplicate", report: duplicate };
      const now = new Date().toISOString();
      const report: StoredReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ownerUid,
        dedupeKey,
        status: "submitted",
        draft: structuredClone(draft),
        incubationMinutes: calculateIncubationMinutes(draft),
        createdAt: now,
        updatedAt: now,
      };
      setReports((current) => [report, ...current]);
      return { kind: "created", report };
    },
    updateReport(reportId, ownerUid, draft) {
      const existing = reports.find((report) => report.id === reportId && report.ownerUid === ownerUid);
      if (!existing) return null;
      const nextKey = makeDedupeKey(ownerUid, draft.restaurantInternalId, draft.mealDate);
      const conflicts = reports.some((report) => report.id !== reportId && report.dedupeKey === nextKey && report.status !== "rejected");
      if (conflicts) return null;
      const updated: StoredReport = {
        ...existing,
        dedupeKey: nextKey,
        draft: structuredClone(draft),
        incubationMinutes: calculateIncubationMinutes(draft),
        updatedAt: new Date().toISOString(),
      };
      setReports((current) => current.map((report) => report.id === reportId ? updated : report));
      return updated;
    },
    getReport(reportId) {
      return reports.find((report) => report.id === reportId);
    },
    setReportStatus(actorUid, reportId, status, note) {
      const report = reports.find((item) => item.id === reportId);
      if (!report || !canTransitionReport(report.status, status)) return false;
      setReports((current) => current.map((item) => item.id === reportId ? { ...item, status, updatedAt: new Date().toISOString() } : item));
      setAuditEvents((current) => [{
        id: `audit_${Date.now()}`,
        actorUid,
        action: "report_status_changed",
        reportId,
        before: report.status,
        after: status,
        note,
        createdAt: new Date().toISOString(),
      }, ...current]);
      return true;
    },
  }), [auditEvents, reports]);

  return <ReportStore.Provider value={value}>{children}</ReportStore.Provider>;
}

export function useReports() {
  const value = useContext(ReportStore);
  if (!value) throw new Error("useReports must be used inside ReportStoreProvider");
  return value;
}
