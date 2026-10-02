"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../auth/auth-context";
import { useI18n } from "../i18n/context";
import { getFirebaseClient } from "../firebase/client";
import { defaultFilters, facts, filterReports, koreaDate, statusLabels, summarize, type AnalyticsFilters, type AnalyticsReport, type Breakdown } from "./analytics-model";
import { answerLabels, buildAnalyticsWorkbook, cdcMealRows, companionRows, detailRows, localizeDetailValue } from "./analytics-export";
import "./analytics.css";

type Page = { reports: AnalyticsReport[]; nextCursor: string | null };
const errorText = (e: unknown) => e instanceof Error ? e.message : "자료를 불러오지 못했습니다.";
export function AnalyticsPanel() {
  const { firebaseMode } = useAuth();
  const { t, locale } = useI18n();
  const [reports, setReports] = useState<AnalyticsReport[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>({ ...defaultFilters });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reportKey = (r: AnalyticsReport) => `${r.source}:${r.id}`;
  const clearSelection = () => { setChecked(new Set()); setConfirmDelete(false); };
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const invalidRange = !!filters.start && !!filters.end && filters.start > filters.end;
  const selected = useMemo(() => invalidRange ? [] : filterReports(reports, filters).sort((a,b) => b.createdAt.localeCompare(a.createdAt)), [reports, filters, invalidRange]);
  const summary = useMemo(() => summarize(selected, filters.dateBasis), [selected, filters.dateBasis]);
  const patch = (key: keyof AnalyticsFilters, value: string) => { clearSelection(); setFilters(f => ({ ...f, [key]: value, detailGroup: "", detailKey: "" })); setPage(0); };
  function drill(group: string, key: string) {
    if (deleting) return;
    clearSelection();
    setFilters(f => ({ ...f, detailGroup: group, detailKey: key })); setPage(0);
    document.getElementById("analytics-reports")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function load() {
    clearSelection();
    const current = ++generation.current;
    setLoading(true); setMessage(""); setLoadedAt(""); setReports([]); setPage(0);
    try {
      const client = getFirebaseClient();
      if (!client) throw new Error("서버 연결을 확인해주세요.");
      const get = httpsCallable<Record<string,unknown>, Page>(client.functions, "getAdminAnalyticsPage");
      const all: AnalyticsReport[] = [];
      let size = 0;
      for (const source of ["symptom", "cdc"] as const) {
        let cursor: string | null = null;
        do {
          const response: Page = (await get({ source, ...(cursor ? { cursor } : {}) })).data;
          if (generation.current !== current) return;
          size += new TextEncoder().encode(JSON.stringify(response.reports)).length;
          all.push(...response.reports);
          if (all.length > 10000 || size > 40000000) throw new Error("한 번에 조회할 수 있는 자료량을 초과했습니다. 전체 통계로 오해하지 않도록 부분 결과는 표시하지 않습니다.");
          if (response.nextCursor && response.nextCursor === cursor) throw new Error("목록을 이어서 읽지 못했습니다. 다시 조회해주세요.");
          cursor = response.nextCursor;
          setMessage(`${all.length}건을 불러오는 중입니다…`);
        } while (cursor);
      }
      setReports(all); setLoadedAt(new Date().toISOString()); setMessage(`${all.length}건 조회 완료`);
    } catch (e) { if (generation.current === current) setMessage(errorText(e)); }
    finally { if (generation.current === current) setLoading(false); }
  }
  async function removeSelected() {
    const targets = selected.filter(r => checked.has(reportKey(r)));
    if (!targets.length || deleting) return;
    setDeleting(true); setConfirmDelete(false);
    let completed = 0;
    try {
      const client = getFirebaseClient();
      if (!client) throw new Error("서버 연결을 확인해주세요.");
      const remove = httpsCallable<unknown, { processed: string[] }>(client.functions, "deleteAdminReports");
      for (let offset = 0; offset < targets.length; offset += 25) {
        const response = await remove({ confirmation: "삭제", reports: targets.slice(offset, offset + 25).map(({ source, id, updatedAt, revision }) => ({ source, id, updatedAt, revision })) });
        const removed = new Set(response.data.processed);
        completed += removed.size;
        setReports(current => current.filter(r => !removed.has(reportKey(r))));
        setChecked(current => new Set([...current].filter(key => !removed.has(key))));
        setMessage(`${completed} / ${targets.length}건 삭제 처리 중…`);
      }
      setPage(0); setMessage(`${completed}건 삭제 처리 완료. 통계에 반영했으며 지도는 자동으로 다시 집계됩니다.`);
    } catch (e) {
      setPage(0); setMessage(`${completed}건 처리 후 중단되었습니다. ${errorText(e)} 남은 선택 항목을 확인해주세요.`);
    } finally { setDeleting(false); }
  }
  async function download() {
    setExporting(true); setMessage("");
    try {
      const client = getFirebaseClient();
      if (!client) throw new Error("서버 연결을 확인해주세요.");
      const audit = await httpsCallable<Record<string,unknown>, { auditId: string }>(client.functions, "recordAdminAnalyticsExport")({ filters, rowCount: selected.length, loadedAt });
      const workbook = await buildAnalyticsWorkbook(selected, filters, loadedAt, audit.data.auditId, t);
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = `나두아파_신고통계_${koreaDate(new Date().toISOString())}.xlsx`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(`${selected.length}건의 엑셀 파일을 생성했습니다.`);
    } catch (e) { setMessage(errorText(e)); }
    finally { setExporting(false); }
  }
  const breakdown = (title: string, group: string, rows: Breakdown[]) => <section className="analytics-breakdown" key={group}><h3>{t(title)}</h3><div className="analytics-scroll"><table><thead><tr><th>{t("항목")}</th><th>{t("신고")}</th><th>{t("회원")}</th></tr></thead><tbody>{rows.map(r => <tr key={r.key}><td><button type="button" onClick={() => drill(group,r.key)}>{["regions", "restaurants"].includes(group) ? r.label : t(r.label)}</button><div className="analytics-bar" style={{ width: `${100*r.count/Math.max(1,selected.length)}%` }} /></td><td>{r.count}</td><td>{r.owners}</td></tr>)}</tbody></table>{!rows.length && <p>{t("해당 자료가 없습니다.")}</p>}</div></section>;
  return <section className="analytics-panel">
    <h2>{t("신고 통계·엑셀")}</h2>
    <p>{t("모든 회원의 증상 신고를 기본으로 표시합니다. 먼저 자료를 조회해주세요. 1차 버전은 전체 1만 건·40MB까지 조회할 수 있습니다.")}</p>
    <div className="analytics-actions"><button className="primary-button" type="button" disabled={loading || exporting || deleting || !firebaseMode} onClick={() => void load()}>{t(loading ? "조회 중…" : "전체 자료 새로고침")}</button><button type="button" disabled={!loadedAt || loading || exporting || deleting || invalidRange} onClick={() => void download()}>{t(exporting ? "엑셀 생성 중…" : "현재 조건으로 엑셀 다운로드")}</button></div>
    {!firebaseMode && <p>{t("통계는 서버에 저장된 신고를 사용하는 운영 로그인에서 제공됩니다.")}</p>}
    <fieldset className="analytics-filters" disabled={loading || exporting || deleting}><legend>{t("조회 조건")}</legend>
      <label>{t("신고 양식")}<select value={filters.source} onChange={e => patch("source",e.target.value)}><option value="symptom">{t("증상 신고")}</option><option value="cdc">{t("CDC 신고")}</option><option value="all">{t("두 양식 전체")}</option></select></label>
      <label>{t("날짜 기준")}<select value={filters.dateBasis} onChange={e => patch("dateBasis",e.target.value)}><option value="created">{t("신고일 (한국 시간)")}</option><option value="meal">{t("식사일")}</option></select></label>
      <label>{t("시작일")}<input type="date" value={filters.start} onChange={e => patch("start",e.target.value)} /></label>
      <label>{t("종료일")}<input type="date" value={filters.end} onChange={e => patch("end",e.target.value)} /></label>
      <label>{t("지역")}<input placeholder={t("지역 이름 검색")} value={filters.region} maxLength={200} onChange={e => patch("region",e.target.value)} /></label>
      <label>{t("음식점")}<input placeholder={t("음식점 이름 검색")} value={filters.restaurant} maxLength={200} onChange={e => patch("restaurant",e.target.value)} /></label>
      <label>{t("증상")}<select value={filters.symptom} onChange={e => patch("symptom",e.target.value)}><option value="">{t("전체")}</option>{["설사","구토","복통","발열","오한","혈변","두통","근육통","기타"].map(s => <option value={s} key={s}>{t(s)}</option>)}</select></label>
      <label>{t("검토 상태")}<select value={filters.status} onChange={e => patch("status",e.target.value)}><option value="">{t("전체")}</option>{Object.entries(statusLabels).map(([k,v]) => <option value={k} key={k}>{t(v)}</option>)}</select></label>
      <button type="button" onClick={() => { clearSelection(); setFilters({ ...defaultFilters }); setPage(0); }}>{t("조건 초기화")}</button>
    </fieldset>
    {invalidRange && <p role="alert">{t("시작일은 종료일 이전이어야 합니다.")}</p>}
    <p role="status">{t(message)}</p>
    {loadedAt && <>
      <p className="analytics-note">{t("조회 완료")} {new Date(loadedAt).toLocaleString(locale, { timeZone: "Asia/Seoul" })} · {t("실시간 고정 스냅샷이 아닙니다. 최신 변경은 새로고침해주세요.")}</p>
      {filters.detailGroup && <p className="analytics-note">{t("선택 항목")}: {t(answerLabels[filters.detailKey] ?? filters.detailKey)} <button type="button" onClick={() => { clearSelection(); setFilters(f => ({ ...f, detailGroup: "", detailKey: "" })); setPage(0); }}>{t("항목 선택 해제")}</button></p>}
      <div className="analytics-cards">{[["신고 건수",summary.count],["신고한 회원",summary.owners],["동행 증상자 합계",summary.companions],["병원 방문 신고",summary.medical],["입원 신고",summary.hospitalized]].map(([label,value],i) => <button key={label} type="button" onClick={() => i === 3 ? drill("medical","yes") : i === 4 ? drill("hospitalized","yes") : document.getElementById("analytics-reports")?.scrollIntoView({ behavior: "smooth" })}><span>{t(String(label))}</span><strong>{value}</strong></button>)}</div>
      <p className="analytics-note">{t("동행 인원 미응답")} {summary.unknownCompanions} {t("건")}. {t("동행자는 신고 간 중복될 수 있습니다. 증상은 복수 선택이며, 두 양식의 같은 사건은 자동 병합하지 않습니다. CDC 지역·음식점은 자유 입력 기준입니다. 식사일로 기간을 지정하면 식사일 미입력 신고가 제외됩니다.")}</p>
      <div className="analytics-grids">{breakdown("날짜별 추이", "dates",summary.dates)}{breakdown("지역별", "regions",summary.regions)}{breakdown("음식 유형별", "categories",summary.categories)}{breakdown("증상별 (복수 선택)", "symptoms",summary.symptoms)}{breakdown("음식점별 현황", "restaurants",summary.restaurants)}</div>
      <details><summary>{t("병원 방문·입원 응답 구분")}</summary><p>{t("병원 방문")}: {summary.medicalAnswers.map(r => `${t(answerLabels[r.key] ?? r.key)}: ${r.count}`).join(" · ")}</p><p>{t("입원")}: {summary.hospitalAnswers.map(r => `${t(answerLabels[r.key] ?? r.key)}: ${r.count}`).join(" · ")}</p></details>
      <section id="analytics-reports"><h3>{t("조건에 해당하는 상세 신고")} ({selected.length})</h3>
        <div className="analytics-actions">
          <label className="analytics-select"><input type="checkbox" aria-label={t("현재 조건 전체 선택")} disabled={deleting || !selected.length} checked={!!selected.length && selected.every(r => checked.has(reportKey(r)))} onChange={e => { setChecked(e.target.checked ? new Set(selected.map(reportKey)) : new Set()); setConfirmDelete(false); }} />{t("현재 조건 전체 선택")} ({selected.length})</label>
          <span>{checked.size}건 선택</span>
          <button type="button" disabled={deleting || !checked.size} onClick={clearSelection}>{t("선택 해제")}</button>
          <button className="analytics-delete" type="button" disabled={deleting || !checked.size} onClick={() => setConfirmDelete(true)}>{t(deleting ? "삭제 중…" : "선택한 신고 삭제")}</button>
        </div>
        <p className="analytics-note">{t("전체 선택은 현재 조건에 해당하는 모든 페이지의 신고를 선택합니다. 조회 조건을 바꾸면 선택이 해제됩니다.")}</p>
        {confirmDelete && <div className="analytics-delete-confirm" role="alert">
          <p>선택한 신고 {checked.size}건과 연결된 동행자 자료를 영구 삭제합니다. 복구할 수 없으며 회원 계정은 유지됩니다.</p>
          <button type="button" className="analytics-delete" onClick={() => void removeSelected()}>확인 — {checked.size}건 삭제</button> <button type="button" onClick={() => setConfirmDelete(false)}>{t("취소")}</button>
        </div>}
        {!selected.length && <p>{t("해당 자료가 없습니다.")}</p>}
        {selected.slice(page*25,(page+1)*25).map(r => <div className="analytics-selectable-record" key={reportKey(r)}><label className="analytics-select"><input type="checkbox" disabled={deleting} checked={checked.has(reportKey(r))} onChange={e => { const value = e.target.checked; setChecked(current => { const next = new Set(current); if (value) next.add(reportKey(r)); else next.delete(reportKey(r)); return next; }); setConfirmDelete(false); }} aria-label={`${facts(r).restaurant} ${r.id} 신고 선택`} />{t("선택")}</label><details className="analytics-record"><summary>{r.source === "cdc" ? "CDC" : t("증상 신고")} · {koreaDate(r.createdAt)} · {facts(r).restaurant} · {t(statusLabels[r.status] ?? r.status)}</summary><p>{r.id} · {r.ownerUid}</p><p>{t("검토 메모")}: {r.reviewNote || t("없음")}</p><dl>{detailRows(r).map(([k,v]) => <div key={k}><dt>{t(k)}</dt><dd>{localizeDetailValue(k, v, t)}</dd></div>)}</dl>{[...companionRows(r),...cdcMealRows(r)].map((rows,i) => <div key={i}><h4>{t(r.source === "cdc" ? "식사 기록" : "동행자")} {i+1}</h4><dl>{rows.map(([k,v]) => <div key={k}><dt>{t(k)}</dt><dd>{localizeDetailValue(k, v, t)}</dd></div>)}</dl></div>)}</details></div>)}
        <div className="analytics-actions"><button type="button" disabled={page === 0} onClick={() => setPage(p => p-1)}>{t("이전")}</button><span>{page+1} / {Math.max(1,Math.ceil(selected.length/25))}</span><button type="button" disabled={(page+1)*25 >= selected.length} onClick={() => setPage(p => p+1)}>{t("다음")}</button></div>
      </section>
    </>}
  </section>;
}

