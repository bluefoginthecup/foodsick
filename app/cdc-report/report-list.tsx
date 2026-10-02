"use client";
import { useI18n } from "../i18n/context";

import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { answers, basicFields, detailGroups, mealFields, type Field } from "../../functions/src/domain/cdc";
import { listCdc, deleteCdc, reviewCdc, type CdcReport } from "./api";
import "./cdc.css";
function Rows({ fields, values }: { fields: Field[]; values: Record<string, string> }) {
  const { text } = useI18n();
  return <dl>{fields.map(f => <div key={f.key}><dt>{text(f.label)}</dt><dd>{!values[f.key] ? text("미응답") : f.type === "answer" ? text(answers[values[f.key] as keyof typeof answers]) : f.options ? text(f.options[values[f.key]] ?? values[f.key]) : values[f.key]}</dd></div>)}</dl>;
}
function ReportDetails({ report }: { report: CdcReport }) {
  const { t, text, locale } = useI18n();
  const d = report.draft;
  return <div className="cdc-details"><h3>{t("간편 신고")}</h3><p>{t("증상: ")}{text(d.symptoms.join(", "))}</p><Rows fields={basicFields} values={d.basic} />{text(detailGroups.map(g => <div key={g.title}><h3>{text(g.title)}</h3><Rows fields={g.fields} values={d.detail} /></div>))}<h3>{t("식사·식품 기록 (")}{text(d.meals.length)}{t("개)")}</h3>{text(d.meals.length ? d.meals.map((m, i) => <div key={i}><h4>{t("식사 ")}{text(i + 1)}</h4><Rows fields={mealFields} values={m} /></div>) : <p>{t("추가한 식사 기록이 없습니다.")}</p>)}<p>{t("건강정보 수집·이용 동의: ")}{text(d.consent ? "동의함" : "동의하지 않음")}</p><p className="cdc-meta">{t("양식: ")}{text(report.formVersion)}{t(" · 수정 버전: ")}{text(report.revision)}<br />{t("신고 번호: ")}{text(report.id)}<br />{t("최종 수정: ")}{text(new Date(report.updatedAt).toLocaleString(locale))}</p></div>;
}
export function CdcReportList({ admin = false, ownerUid }: { admin?: boolean; ownerUid?: string }) {
  const { t, text, locale } = useI18n();
  const { user, firebaseMode } = useAuth();
  const [reports, setReports] = useState<CdcReport[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(""); const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listCdc(firebaseMode, user.uid, { admin, ownerUid }).then(result => { if (!cancelled) { setReports(result.reports); setCursor(result.nextCursor); } }).catch(() => { if (!cancelled) setError("CDC 신고 목록을 불러오지 못했습니다."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, firebaseMode, admin, ownerUid, retry]);
  function reload() { setLoading(true); setError(""); setRetry(n => n + 1); }
  return <section className="cdc-list" aria-label={t(admin ? "관리자 CDC 신고 목록" : "내 CDC 신고 목록")}><div className="cdc-list-heading"><h2>{t("CDC 신고")}</h2>{text(!admin && <NativeLink href="/cdc-report" className="small-action">{t("새 CDC 신고")}</NativeLink>)}<button type="button" disabled={loading || busy} onClick={reload}>{t("새로고침")}</button></div><p>{t("시험 운영 · 기존 증상 신고 및 공개 지도 집계와 별도로 관리됩니다.")}</p>
    {text(loading && <p role="status">{t("목록을 불러오는 중…")}</p>)}{text(error && <p role="alert" className="cdc-error">{text(error)}</p>)}{text(!loading && !error && !reports.length && <p>{t("접수된 CDC 신고가 없습니다.")}</p>)}
    {text(reports.map(report => { const detailed = Object.values(report.draft.detail).some(Boolean) || report.draft.meals.some(m => Object.values(m).some(Boolean)); return <article key={report.id}><strong>{text(report.status === "reviewed" ? "검토 완료" : "접수됨")} · {text(detailed ? "상세 정보 있음" : "간편 신고만 작성")}</strong><h3>{text(report.draft.symptoms.join(" · "))}</h3><time>{text(new Date(report.createdAt).toLocaleString(locale))}</time>{text(admin && <p className="cdc-meta">{t("회원: ")}{text(report.ownerUid)}</p>)}<p>{t("시작일: ")}{text(report.draft.basic.onsetPrecision === "unknown" ? "모름" : report.draft.basic.onsetDate || "미응답")} · {report.draft.basic.place || t("음식점 미입력")}</p><details><summary>{t("작성한 내용 전체 보기")}</summary><ReportDetails report={report} /></details>{text(report.reviewNote && <p>{t("관리자 검토 메모: ")}{report.reviewNote}</p>)}
      {text(admin ? <div className="cdc-review"><label htmlFor={`note-${report.id}`}>{t("검토 메모 (회원에게도 표시됩니다)")}</label><textarea id={`note-${report.id}`} maxLength={1000} value={notes[report.id] ?? report.reviewNote} onChange={e => setNotes({ ...notes, [report.id]: e.target.value })} /><button type="button" className="secondary-button" disabled={busy || loading} onClick={() => { setBusy(true); setError(""); void reviewCdc(firebaseMode, report, notes[report.id] ?? report.reviewNote).then(reload).catch(() => setError("검토를 저장하지 못했습니다. 내용이 변경되었을 수 있으니 새로고침해주세요.")).finally(() => setBusy(false)); }}>{t("검토 완료로 저장")}</button></div> : <div className="cdc-actions"><NativeLink className="secondary-button" href={`/cdc-report?edit=${encodeURIComponent(report.id)}`}>{t("수정·상세 조사 이어 쓰기")}</NativeLink><button type="button" disabled={busy} onClick={() => setConfirm(report.id)}>{t("삭제")}</button>{text(confirm === report.id && <div role="group" aria-label={t("CDC 신고 삭제 확인")}><p>{t("기본 정보와 상세 조사가 함께 삭제됩니다. 복구할 수 없습니다.")}</p><button type="button" disabled={busy} onClick={() => setConfirm("")}>{t("취소")}</button><button type="button" className="danger-button" disabled={busy} onClick={() => { if (!user) return; setBusy(true); setError(""); void deleteCdc(firebaseMode, user.uid, report.id).then(() => { setConfirm(""); reload(); }).catch(() => setError("삭제하지 못했습니다. 다시 시도해주세요.")).finally(() => setBusy(false)); }}>{t("삭제 확정")}</button></div>)}</div>)}
    </article>; }))}
    {text(cursor && <button type="button" className="secondary-button" disabled={busy || loading} onClick={() => { if (!user) return; setLoading(true); setError(""); void listCdc(firebaseMode, user.uid, { admin, ownerUid, cursor }).then(result => { setReports(old => [...old, ...result.reports.filter(r => !old.some(o => o.id === r.id))]); setCursor(result.nextCursor); }).catch(() => setError("다음 목록을 불러오지 못했습니다.")).finally(() => setLoading(false)); }}>{t("이전 CDC 신고 더 보기")}</button>)}
  </section>;
}
