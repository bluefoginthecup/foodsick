"use client";
import { useI18n } from "../i18n/context";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { answers, basicFields, detailGroups, mealFields, symptoms, emptyCdcDraft, validateCdcDraft, type CdcDraft, type CdcIssue, type Field } from "../../functions/src/domain/cdc";
import { listCdc, saveCdc } from "./api";
import { findRestaurantCandidates, type RestaurantCandidate } from "../report/restaurant-matcher";
import "./cdc.css";

export default function CdcReportPage() {
  const { text, t } = useI18n();
  const { user, loading, firebaseMode } = useAuth();
  const edit = useSearchParams().get("edit");
  const [draft, setDraft] = useState<CdcDraft>(emptyCdcDraft);
  const [id, setId] = useState(""); const [revision, setRevision] = useState(0);
  const [screen, setScreen] = useState<"basic" | "success" | "detail">("basic");
  const [issues, setIssues] = useState<CdcIssue[]>([]); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [ready, setReady] = useState(!edit);
  const [retry, setRetry] = useState(0); const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState(""); const [places, setPlaces] = useState<RestaurantCandidate[]>([]);
  const [searching, setSearching] = useState(false); const [searchMessage, setSearchMessage] = useState("");
  const searchVersion = useRef(0);
  useEffect(() => {
    if (!edit || !user) return;
    let cancelled = false;
    void listCdc(firebaseMode, user.uid, { id: edit }).then(result => {
      if (cancelled) return;
      const report = result.reports[0]; if (!report) throw new Error("신고가 없습니다.");
      setDraft(report.draft); setId(report.id); setRevision(report.revision); setReady(true); setMessage("");
    }).catch(() => { if (!cancelled) setMessage("신고를 불러오지 못했습니다. 다시 시도해주세요."); });
    return () => { cancelled = true; };
  }, [edit, user, firebaseMode, retry]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function change(next: CdcDraft) { setDraft(next); setDirty(true); setMessage(""); }
  function go(next: typeof screen) { setScreen(next); setIssues([]); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function focus(field: string) { const el = document.getElementById(`cdc-${field}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus(); }
  async function save() {
    const checked = validateCdcDraft(draft);
    setIssues(checked.issues);
    if (checked.issues.length) {
      if (checked.issues[0]!.field.startsWith("detail.") || checked.issues[0]!.field.startsWith("meals")) setScreen("detail"); else setScreen("basic");
      setTimeout(() => focus(checked.issues[0]!.field), 50); return;
    }
    if (!user) return;
    setBusy(true); setMessage("");
    const reportId = id || crypto.randomUUID(); setId(reportId);
    try {
      const result = await saveCdc(firebaseMode, user.uid, reportId, revision, checked.draft);
      setRevision(result.revision); setDraft(checked.draft); setDirty(false); go("success");
      window.history.replaceState(null, "", `/cdc-report?edit=${encodeURIComponent(reportId)}`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMessage(code === "functions/aborted" ? "다른 화면에서 변경되었거나 저장 응답이 늦었습니다. 내 신고에서 저장 여부를 확인하고 다시 열어주세요." : "저장하지 못했습니다. 입력 내용은 이 화면에 남아 있습니다. 다시 시도해주세요.");
    } finally { setBusy(false); }
  }
  function field(f: Field, prefix: "basic" | "detail" | `meals.${number}`, values: Record<string, string>) {
    const path = `${prefix}.${f.key}`; const error = issues.find(i => i.field === path);
    const required = prefix === "basic" && (["onsetPrecision", "suspectedMeal", "medical", "hospitalized", "tested"].includes(f.key) || (f.key === "onsetDate" && draft.basic.onsetPrecision !== "unknown") || (f.key === "onsetTime" && draft.basic.onsetPrecision === "exact") || (f.key === "otherSymptom" && draft.symptoms.includes("기타")) || (f.key === "source" && draft.basic.suspectedMeal === "yes"));
    const update = (value: string) => {
      if (prefix.startsWith("meals.")) { const n = Number(prefix.split(".")[1]); change({ ...draft, meals: draft.meals.map((m, i) => i === n ? { ...m, [f.key]: value } : m) }); }
      else {
        const group = prefix as "basic" | "detail"; const next = { ...draft[group], [f.key]: value };
        if (f.key === "onsetPrecision" && value === "unknown") { delete next.onsetDate; delete next.onsetTime; }
        if (f.key === "onsetPrecision" && value === "approximate") delete next.onsetTime;
        if (f.key === "suspectedMeal" && value === "unknown") for (const k of ["source", "mealDate", "mealTime", "place", "address", "menu"]) delete next[k];
        change({ ...draft, [group]: next });
      }
    };
    const attrs = { id: `cdc-${path}`, "aria-invalid": !!error, "aria-describedby": error ? `err-${path}` : undefined, value: values[f.key] ?? "", required };
    const options = f.type === "answer" ? answers : f.options;
    return <label className="cdc-field" key={path} htmlFor={`cdc-${path}`}><span>{text(f.label)} {text(required && <b className="cdc-required">{t("필수")}</b>)}</span>
      {text(options ? <select {...attrs} onChange={e => update(e.target.value)}><option value="">{t("선택하지 않음")}</option>{text(Object.entries(options).map(([v, label]) => <option key={v} value={v}>{text(label)}</option>))}</select> : <input {...attrs} type={f.type} maxLength={1000} min={f.type === "number" ? 0 : undefined} max={f.type === "number" ? f.max : undefined} onInput={e => update(e.currentTarget.value)} onChange={e => update(e.target.value)} />)}
      {text(error && <small className="cdc-error" id={`err-${path}`}>{text(error.message)}</small>)}</label>;
  }
  const visibleBasic = basicFields.filter(f => {
    if (f.key === "otherSymptom") return draft.symptoms.includes("기타");
    if (f.key === "onsetDate") return draft.basic.onsetPrecision && draft.basic.onsetPrecision !== "unknown";
    if (f.key === "onsetTime") return draft.basic.onsetPrecision === "exact";
    if (["source", "mealDate", "mealTime", "place", "address", "menu"].includes(f.key)) return draft.basic.suspectedMeal === "yes";
    return true;
  });
  if (loading) return <main className="cdc-page"><p role="status">{t("로그인 확인 중…")}</p></main>;
  return <main className="cdc-page">
    <header><p className="eyebrow">{t("기존 증상 신고와 별도로 시험 운영")}</p><h1>{t("CDC 신고")}</h1><p>{t("기본 정보만 먼저 접수하고, 기억나는 내용을 나중에 더해주세요.")}</p></header>
    <aside className="cdc-notice">{t("미국 CDC의 NHGQ 문항을 참고한 나두아파용 양식입니다. 미국 CDC로 전송되거나 공식 역학조사로 접수되는 것은 아닙니다. 비교 운영 중에는 공개 지도 집계에 포함하지 않습니다. ")}<a href="https://cifor.us/uploads/resources/NHGQ-Modified_Feb2025.pdf" target="_blank" rel="noreferrer">{t("참고 문항 원문 ↗")}</a></aside>
    {text(!user ? <section className="cdc-card"><h2>{t("로그인 후 작성해주세요")}</h2><NativeLink className="primary-button" href="/login?returnTo=%2Fcdc-report">{t("로그인하고 CDC 신고 작성")}</NativeLink></section> : !ready ? <section className="cdc-card"><p role="status">{text(message || "신고를 불러오는 중…")}</p><button type="button" onClick={() => setRetry(n => n + 1)}>{t("다시 불러오기")}</button></section> : screen === "success" ? <section className="cdc-card" aria-live="polite"><h2>{t("CDC 신고가 저장됐어요")}</h2><p>{t("기본 접수는 완료됐습니다. 추가 정보는 선택이며, 내 신고에서 다시 열어 수정할 수 있습니다.")}</p><div className="cdc-actions"><button type="button" className="primary-button" onClick={() => go("detail")}>{t("추가 정보 작성하기")}</button><NativeLink className="secondary-button" href="/my-reports">{t("지금은 마치기")}</NativeLink></div></section> : <>
      <nav className="cdc-steps" aria-label={t("신고 단계")}><button aria-current={screen === "basic" ? "step" : undefined} type="button" onClick={() => go("basic")}>{t("1. 간편 신고")}</button><button disabled={!revision} aria-current={screen === "detail" ? "step" : undefined} type="button" onClick={() => go("detail")}>{t("2. 상세 조사 · 선택")}</button></nav>
      {text(issues.length > 0 && <div className="cdc-errors" role="alert"><strong>{t("확인이 필요한 항목을 눌러 이동하세요")}</strong>{text(issues.map(i => <button type="button" key={i.field} onClick={() => { setScreen(i.field.startsWith("basic") || ["symptoms", "consent"].includes(i.field) ? "basic" : "detail"); setTimeout(() => focus(i.field), 50); }}>{text(i.message)}</button>))}</div>)}
      <form noValidate onSubmit={e => { e.preventDefault(); void save(); }}>
        <fieldset disabled={busy} className="cdc-form-body">
        {text(screen === "basic" ? <section className="cdc-card"><h2>{t("간편 신고")}</h2><p>{t("‘필수’ 표시만 작성하면 접수할 수 있습니다. 기억이 안 나는 정보는 ‘모름’을 선택하세요.")}</p>
          <fieldset className="cdc-symptoms" id="cdc-symptoms" tabIndex={-1} aria-invalid={issues.some(i => i.field === "symptoms")}><legend>{t("어떤 증상이 있었나요? ")}<b className="cdc-required">{t("필수")}</b></legend>{text(symptoms.map(s => <label key={s}><input type="checkbox" checked={draft.symptoms.includes(s)} onChange={e => change({ ...draft, symptoms: e.target.checked ? [...draft.symptoms, s] : draft.symptoms.filter(v => v !== s) })} />{text(s)}</label>))}{text(issues.filter(i => i.field === "symptoms").map(i => <p className="cdc-error" key={i.field}>{text(i.message)}</p>))}</fieldset>
          {text(visibleBasic.map(f => <div key={f.key}>{text(f.key === "place" && <div className="cdc-search"><label htmlFor="cdc-search">{t("음식점 검색 · 선택")}</label><div><input id="cdc-search" value={query} placeholder={t("지역 선택 없이 상호 검색")} onChange={e => { searchVersion.current++; setQuery(e.target.value); setPlaces([]); }} /><button type="button" disabled={searching || query.trim().length < 2} onClick={() => { const version = ++searchVersion.current; setSearching(true); setSearchMessage(""); void findRestaurantCandidates(query, "").then(results => { if (version === searchVersion.current) { setPlaces(results); setSearchMessage(results.length ? "음식점을 선택하면 이름과 주소가 입력됩니다." : "검색 결과가 없습니다. 아래에 직접 입력할 수 있습니다."); } }).catch(() => setSearchMessage("검색이 되지 않습니다. 아래에 직접 입력해주세요.")).finally(() => setSearching(false)); }}>{text(searching ? "검색 중…" : "검색")}</button></div><p role="status">{text(searchMessage)}</p>{text(places.map(p => <button className="cdc-place" type="button" key={p.internalId} onClick={() => { change({ ...draft, basic: { ...draft.basic, place: p.name, address: p.address } }); setPlaces([]); setSearchMessage("이름과 주소를 입력했습니다."); }}>{p.name}<small>{p.address}</small></button>))}<small>{t("검색되지 않으면 아래 이름과 주소를 직접 적어주세요. 모르면 비워두어도 됩니다.")}</small></div>)}{text(field(f, "basic", draft.basic))}</div>))}
          <div className="cdc-consent"><strong>{t("건강정보 수집·이용 동의")}</strong><p>{t("나두아파가 증상·진료·검사·식사 및 노출 정보를 신고 검토와 양식 비교 운영 목적으로 수집합니다. 본인과 권한 있는 관리자가 확인하며, 신고 삭제 또는 회원 탈퇴 시 삭제합니다. 동의하지 않으면 CDC 신고를 제출할 수 없습니다.")}</p><label><input id="cdc-consent" type="checkbox" checked={draft.consent} onChange={e => change({ ...draft, consent: e.target.checked })} />{t(" 건강정보 수집·이용에 동의합니다. ")}<b className="cdc-required">{t("필수")}</b></label>{text(issues.some(i => i.field === "consent") && <p className="cdc-error">{t("건강정보 수집·이용 동의가 필요합니다.")}</p>)}</div>
        </section> : <>
          <section className="cdc-card"><h2>{t("선택형 상세 조사")}</h2><p>{t("모든 항목은 선택입니다. 비워두면 ‘미응답’으로 저장되며 ‘아니요’와 구분됩니다. 중간에 저장하고 내 신고에서 이어 쓸 수 있습니다.")}</p></section>
          {text(detailGroups.map(group => <section className="cdc-card" key={group.title}><h2>{text(group.title)}</h2><p>{text(group.help)}</p>{text(group.fields.map(f => field(f, "detail", draft.detail)))}</section>))}
          <section className="cdc-card" id="cdc-meals" tabIndex={-1}><h2>{t("여러 날의 식사·식품 기록")}</h2><p>{t("증상 시작 전 7일의 식사부터 떠올려주세요. 외식뿐 아니라 집밥·간식·음료·구입 식품도 적을 수 있고, 더 이전 기록도 추가할 수 있습니다. 이것만으로 원인 식품이 확정되지는 않습니다.")}</p>{text(draft.meals.map((meal, i) => <div className="cdc-meal" key={i}><h3>{t("식사 기록 ")}{text(i + 1)}</h3>{text(mealFields.map(f => field(f, `meals.${i}`, meal)))}<button type="button" onClick={() => change({ ...draft, meals: draft.meals.filter((_, n) => n !== i) })}>{t("이 식사 기록 제거")}</button></div>))}<button className="secondary-button" type="button" disabled={draft.meals.length >= 30} onClick={() => change({ ...draft, meals: [...draft.meals, {}] })}>{t("＋ 식사 기록 추가 (")}{text(draft.meals.length)}/30)</button></section>
        </>)}
        <div className="cdc-actions"><button className="primary-button" type="submit">{text(busy ? "저장 중…" : screen === "basic" ? revision ? "기본 정보 수정 저장" : "간편 신고 접수하기" : "상세 조사 저장하기")}</button><NativeLink href="/my-reports">{t("내 신고로")}</NativeLink></div>
        </fieldset>
      </form>
      {text(dirty && <p className="cdc-unsaved">{t("아직 저장하지 않은 내용이 있습니다. 저장 버튼을 눌러주세요.")}</p>)}
      {text(message && <p className="cdc-error" role="alert">{text(message)}</p>)}
    </>)}
    <footer><NativeLink href="/report">{t("기존 증상 신고 이용하기 →")}</NativeLink></footer>
  </main>;
}
