"use client";
import { useI18n } from "../i18n/context";


import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { useReports } from "../reports/report-store";
import { getFirebaseAdminReports, setFirebaseReportStatus, type AdminReport } from "../firebase/report-api";
import { ReportDetails } from "./report-details";

const statuses: Record<string, string> = { submitted: "접수됨", reviewed: "검토 완료", duplicate_suspected: "중복 의심", included_in_cluster: "집계 포함", rejected: "집계 제외" };
export function ReportReviewPanel({ ownerUid }: { ownerUid?: string }) {
  const { t, text } = useI18n();
  const { user, firebaseMode } = useAuth();
  const { reports: demoReports, setReportStatus } = useReports();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!firebaseMode) return;
    void getFirebaseAdminReports(undefined, ownerUid).then((result) => {
      if (!cancelled) { setReports(result.reports); setCursor(result.nextCursor); }
    }).catch(() => { if (!cancelled) setError("신고 목록을 불러오지 못했습니다. 다시 시도해주세요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [firebaseMode, refresh, ownerUid]);
  const more = async () => {
    if (!cursor || loading) return;
    setLoading(true); setError("");
    try {
      const result = await getFirebaseAdminReports(cursor, ownerUid);
      setReports((previous) => [...previous, ...result.reports.filter((item) => !previous.some((existing) => existing.id === item.id))]);
      setCursor(result.nextCursor);
    } catch { setError("다음 신고를 불러오지 못했습니다. 다시 시도해주세요."); }
    finally { setLoading(false); }
  };
  const review = async (report: AdminReport, status: "reviewed" | "rejected") => {
    if (!user || busy) return;
    setBusy(report.id); setError(""); setNotice("");
    try {
      const note = notes[report.id]?.trim() || (status === "reviewed" ? "관리자 검토 완료" : "관리자 집계 제외");
      const ok = firebaseMode ? await setFirebaseReportStatus(report.id, status, note) : await setReportStatus(user.uid, report.id, status, note);
      if (!ok) throw new Error();
      setReports((previous) => previous.map((item) => item.id === report.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
      setNotice(`${report.draft?.restaurantDisplayInput || "선택한 신고"}: ${statuses[status]} 처리했습니다.`);
    } catch { setError("검토 결과를 저장하지 못했습니다. 다시 시도해주세요."); }
    finally { setBusy(null); }
  };
  const items = firebaseMode ? reports : demoReports.filter((report) => !ownerUid || report.ownerUid === ownerUid);
  return <section className="admin-list" aria-label={t("전체 신고 검토")}>
    <div className="admin-review-toolbar"><p>{text(items.length)}{t("건 불러옴")}{text(cursor ? " · 다음 신고 있음" : "")}</p>{text(firebaseMode && <button type="button" disabled={loading || !!busy} onClick={() => { setLoading(true); setError(""); setRefresh((n) => n + 1); }}>{t("새로고침")}</button>)}</div>
    {text(error && <p className="form-error" role="alert">{text(error)}</p>)}
    {text(notice && <p role="status">{text(notice)}</p>)}
    {text(firebaseMode && loading && <p role="status">{t("신고를 불러오는 중입니다.")}</p>)}
    {text((!firebaseMode || !loading) && !error && items.length === 0 && <p>{t("접수된 신고가 없습니다.")}</p>)}
    {text(items.map((report) => <article className="admin-report-card full-report" key={report.id}>
      <details>
        <summary><span className={`report-status ${report.status}`}>{text(statuses[report.status] ?? report.status)}</span><strong>{report.draft?.restaurantDisplayInput || t("상호명 기록 없음")}</strong><span>{text([report.draft?.province, report.draft?.city, report.draft?.district].filter(Boolean).join(" "))}</span><b>{t("작성 내용 전체 보기")}</b></summary>
        <ReportDetails report={report} />
        <label className="review-note">{t("검토 메모")}<textarea maxLength={300} value={notes[report.id] ?? ""} onChange={(event) => setNotes((previous) => ({ ...previous, [report.id]: event.target.value }))} placeholder={t("검토 내용 또는 집계 제외 사유")} /></label>
        <div className="admin-actions"><button disabled={!!busy || report.status === "reviewed"} type="button" onClick={() => void review(report, "reviewed")}>{text(busy === report.id ? "저장 중…" : "검토 완료")}</button><button disabled={!!busy || report.status === "rejected"} className="reject" type="button" onClick={() => void review(report, "rejected")}>{t("집계 제외")}</button></div>
      </details>
    </article>))}
    {text(cursor && <button className="secondary-button" type="button" disabled={loading} onClick={() => void more()}>{t("다음 신고 더 보기")}</button>)}
  </section>;
}
