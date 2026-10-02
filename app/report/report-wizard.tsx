"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  COMPANION_GENDERS,
  FOOD_CATEGORIES,
  UNDERLYING_CONDITIONS,
  type CompanionDraft,
  type ReportDraft,
} from "../contracts";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { findRestaurantCandidates, findRestaurantRegion, type RestaurantCandidate } from "./restaurant-matcher";
import { useReports, type StoredReport } from "../reports/report-store";
import { ReportRegionSelect } from "./region-select";
import { reportFieldId, serverReportIssue, validateReportDraft, type ReportIssue } from "./validation";

const symptomOptions = ["설사", "구토", "복통", "발열", "오한", "혈변", "두통", "근육통"];
const steps = ["식사", "증상", "동행", "의료·확인"];
const genderLabels = { female: "여성", male: "남성", other: "기타", undisclosed: "응답하지 않음" } as const;

function emptyCompanion(): CompanionDraft {
  return {
    age: "",
    gender: "",
    symptoms: [],
    otherSymptom: "",
    onsetAt: "",
    medicalVisit: false,
    tested: false,
    underlyingConditions: [],
    otherUnderlyingCondition: "",
  };
}

const initialDraft: ReportDraft = {
  mealDate: "",
  mealTime: "",
  province: "",
  city: "",
  district: "",
  restaurantInternalId: "",
  restaurantDisplayInput: "",
  foodCategory: "",
  foodCategoryDetail: "",
  menu: "",
  serviceMode: "",
  symptoms: [],
  diarrheaCount: 0,
  otherSymptom: "",
  onsetDate: "",
  onsetTime: "",
  partyTotal: 1,
  partySymptomatic: 0,
  companions: [],
  companionSymptoms: [],
  companionOnsetAt: "",
  companionMedicalVisit: false,
  companionTested: false,
  medicalVisit: false,
  hospitalized: false,
  tested: false,
  pathogenKnown: false,
  pathogenType: "",
};

function normalizedDraft(source: ReportDraft): ReportDraft {
  const companions = Array.from(
    { length: source.partySymptomatic ?? 0 },
    (_, index) => source.companions?.[index] ?? (index === 0 && source.companionSymptoms?.length
      ? {
          ...emptyCompanion(),
          symptoms: source.companionSymptoms,
          onsetAt: source.companionOnsetAt,
          medicalVisit: source.companionMedicalVisit,
          tested: source.companionTested,
        }
      : emptyCompanion()),
  );
  return { ...source, foodCategoryDetail: source.foodCategoryDetail ?? "", companions };
}

function ToggleGroup({
  label,
  options,
  values,
  onChange,
  fieldProps,
  error,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  fieldProps?: React.FieldsetHTMLAttributes<HTMLFieldSetElement>;
  error?: React.ReactNode;
}) {
  return (
    <fieldset className="field-block" {...fieldProps}>
      <legend>{label}{fieldProps && <span className="required-mark" aria-hidden="true">필수</span>}</legend>
      <div className="toggle-grid">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              aria-pressed={selected}
              className={selected ? "selected" : ""}
              key={option}
              onClick={() => onChange(selected ? values.filter((item) => item !== option) : [...values, option])}
              type="button"
            >
              <span aria-hidden="true">{selected ? "✓" : "+"}</span>{option}
            </button>
          );
        })}
      </div>
      {error}
    </fieldset>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <fieldset className="field-block compact-field">
      <legend>{label}</legend>
      <div className="yes-no">
        <button aria-pressed={!value} className={!value ? "selected" : ""} onClick={() => onChange(false)} type="button">아니요</button>
        <button aria-pressed={value} className={value ? "selected" : ""} onClick={() => onChange(true)} type="button">예</button>
      </div>
    </fieldset>
  );
}

function calculateIncubation(draft: ReportDraft) {
  if (!draft.mealDate || !draft.mealTime || !draft.onsetDate || !draft.onsetTime) return null;
  const mealAt = new Date(`${draft.mealDate}T${draft.mealTime}:00+09:00`).getTime();
  const onsetAt = new Date(`${draft.onsetDate}T${draft.onsetTime}:00+09:00`).getTime();
  const minutes = Math.round((onsetAt - mealAt) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}시간${remainder ? ` ${remainder}분` : ""}`;
}

export function ReportWizard() {
  const { user, loading, firebaseMode } = useAuth();
  const { createReport, getReport, sessionRestored, updateReport } = useReports();
  const searchParams = useSearchParams();
  const requestedEditId = searchParams.get("edit");
  const requestedReport = requestedEditId ? getReport(requestedEditId) : undefined;
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ReportDraft>(initialDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState(false);
  const [completedReport, setCompletedReport] = useState<StoredReport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [attemptedSteps, setAttemptedSteps] = useState<number[]>([]);
  const [serverIssue, setServerIssue] = useState<ReportIssue | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ field: string; step: number } | null>(null);
  const validationErrors = useMemo(() => validateReportDraft(draft, consented), [draft, consented]);
  const visibleErrors = [...validationErrors.filter((issue) => attemptedSteps.includes(issue.step)), ...(serverIssue ? [serverIssue] : [])];
  const fieldError = (field: string) => visibleErrors.find((issue) => issue.field === field);
  const fieldAttrs = (field: string, label?: string) => ({ id: reportFieldId(field), "aria-label": label, "aria-invalid": !!fieldError(field), "aria-describedby": fieldError(field) ? `error-${field}` : undefined });
  const fieldMessage = (field: string) => fieldError(field) ? <span className="field-error" id={`error-${field}`}>{fieldError(field)!.message}</span> : null;
  const jumpToError = (issue: ReportIssue) => {
    let field = issue.field;
    if (["city", "district"].includes(field) && !draft.province) field = "province";
    else if (["district"].includes(field) && !draft.city) field = "city";

    setStep(issue.step);
    setFocusRequest({ field, step: issue.step });
  };
  useEffect(() => {
    if (!focusRequest || focusRequest.step !== step) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(focusRequest.field === "summary" ? "report-error-summary" : reportFieldId(focusRequest.field));
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      (target?.matches("fieldset") ? target.querySelector<HTMLButtonElement>("button") : target)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, step]);
  const [manualRestaurant, setManualRestaurant] = useState(false);
  const [regionStatus, setRegionStatus] = useState("");
  const regionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => regionRequest.current?.abort(), []);
  const selectRestaurant = async (candidate: RestaurantCandidate) => {
    regionRequest.current?.abort();
    const controller = new AbortController();
    regionRequest.current = controller;
    setRegionStatus("음식점 주소에서 지역을 확인하는 중입니다.");
    setDraft((current) => ({ ...current, province: "", city: "", district: "", restaurantInternalId: candidate.internalId, restaurantDisplayInput: candidate.name, foodCategory: candidate.category as ReportDraft["foodCategory"], foodCategoryDetail: candidate.category === "기타" ? candidate.categoryLabel : "" }));
    try {
      const region = await findRestaurantRegion(candidate, controller.signal);
      if (!controller.signal.aborted) {
        setDraft((current) => current.restaurantInternalId === candidate.internalId ? { ...current, ...region } : current);
        setRegionStatus("음식점 주소로 지역을 자동 입력했어요. 아래에서 확인해주세요.");
      }
    } catch {
      if (!controller.signal.aborted) setRegionStatus("지역을 자동 입력하지 못했습니다. 아래 목록에서 선택해주세요.");
    }
  };
  const [searchAttempt, setSearchAttempt] = useState(0);
  const restaurantSearchKey = draft.restaurantDisplayInput.trim();
  const [restaurantSearch, setRestaurantSearch] = useState<{ key: string; status: "idle" | "loading" | "loaded" | "error"; candidates: RestaurantCandidate[]; message: string }>({
    key: "",
    status: "idle",
    candidates: [],
    message: "",
  });
  const activeRestaurantSearch = restaurantSearch.key === restaurantSearchKey
    ? restaurantSearch
    : { key: restaurantSearchKey, status: draft.restaurantDisplayInput.trim().length >= 2 ? "loading" as const : "idle" as const, candidates: [], message: "" };
  const candidates = activeRestaurantSearch.candidates;
  const incubation = calculateIncubation(draft);

  useEffect(() => {
    const query = draft.restaurantDisplayInput.trim();
    if (query.length < 2 || draft.restaurantInternalId || manualRestaurant) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRestaurantSearch({ key: restaurantSearchKey, status: "loading", candidates: [], message: "음식점을 검색하는 중입니다." });
      void findRestaurantCandidates(query, "", controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) setRestaurantSearch({ key: restaurantSearchKey, status: "loaded", candidates: results, message: results.length ? "" : "검색 결과가 없습니다." });
        })
        .catch((error) => {
          if (!controller.signal.aborted) setRestaurantSearch({ key: restaurantSearchKey, status: "error", candidates: [], message: error instanceof Error ? error.message : "음식점을 검색하지 못했습니다." });
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft.restaurantDisplayInput, draft.restaurantInternalId, restaurantSearchKey, searchAttempt, manualRestaurant]);

  /* The report store is restored after hydration, so edit data must be applied afterwards. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!requestedEditId || !sessionRestored || !user || loadedEditId === requestedEditId) return;
    if (!requestedReport || requestedReport.ownerUid !== user.uid) return;
    setLoadedEditId(requestedEditId);
    setDraft(normalizedDraft(structuredClone(requestedReport.draft)));
    setManualRestaurant(requestedReport.draft.restaurantInternalId.startsWith("manual_"));
    setEditingId(requestedReport.id);
    setStep(3);
    setConsented(false);
    setDuplicateNotice(false);
    setCompletedReport(null);
  }, [loadedEditId, requestedEditId, requestedReport, sessionRestored, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setServerIssue(null);
  };

  const nextStep = () => {
    setAttemptedSteps((current) => [...new Set([...current, step])]);
    if (validationErrors.some((issue) => issue.step === step)) {
      setFocusRequest({ field: "summary", step });
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const setCompanionCount = (value: number) => {
    setDraft((current) => {
      const count = Math.min(Math.max(0, value), Math.max(0, current.partyTotal - 1));
      const companions = Array.from({ length: count }, (_, index) => current.companions[index] ?? emptyCompanion());
      return { ...current, partySymptomatic: count, companions };
    });
  };

  const patchCompanion = <K extends keyof CompanionDraft>(index: number, key: K, value: CompanionDraft[K]) => {
    setDraft((current) => ({
      ...current,
      companions: current.companions.map((companion, companionIndex) => companionIndex === index ? { ...companion, [key]: value } : companion),
    }));
  };

  const submitReport = async () => {
    if (!user || submitting) return;
    setAttemptedSteps([0, 1, 2, 3]);
    if (validationErrors.length) {
      setFocusRequest({ field: "summary", step });
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      if (editingId) {
        const updated = await updateReport(editingId, user.uid, draft);
        if (!updated) throw new Error("신고를 수정할 수 없습니다. 중복 신고 여부를 확인해 주세요.");
        setCompletedReport(updated);
        return;
      }
      const result = await createReport(user.uid, draft);
      if (result.kind === "duplicate") {
        setDraft(normalizedDraft(structuredClone(result.report.draft)));
        setEditingId(result.report.id);
        setDuplicateNotice(true);
        setConsented(false);
        return;
      }
      setCompletedReport(result.report);
    } catch (error) {
      const field = (error as { details?: { field?: string } })?.details?.field;
      const issue = field ? serverReportIssue(field) : null;
      setServerIssue(issue);
      if (issue) setFocusRequest({ field: "summary", step });
      setSubmitError(error instanceof Error ? error.message : "신고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="auth-gate" aria-live="polite">
        <span className="lock-mark" aria-hidden="true">…</span>
        <p className="eyebrow">로그인 확인 중</p>
        <h1>신고 화면을<br />준비하고 있어요</h1>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="auth-gate">
        <span className="lock-mark" aria-hidden="true">!</span>
        <p className="eyebrow">로그인이 필요해요</p>
        <h1>중복 신고를 줄이기 위해<br />카카오 로그인을 먼저 해주세요</h1>
        <p>{firebaseMode ? "프로필과 이메일 없이 카카오 회원 식별값만 안전하게 확인합니다." : "현재는 실제 계정 정보를 사용하지 않는 체험 로그인을 제공합니다."}</p>
        <NativeLink className="kakao-button" href="/login">카카오로 시작하기</NativeLink>
        <NativeLink className="text-link" href="/">지도로 돌아가기</NativeLink>
      </section>
    );
  }

  if (requestedEditId && !sessionRestored) {
    return (
      <section className="auth-gate" aria-live="polite">
        <span className="lock-mark" aria-hidden="true">…</span>
        <p className="eyebrow">신고 불러오는 중</p>
        <h1>저장된 내용을<br />불러오고 있어요</h1>
      </section>
    );
  }

  if (requestedEditId && (!requestedReport || requestedReport.ownerUid !== user.uid)) {
    return (
      <section className="auth-gate">
        <span className="lock-mark" aria-hidden="true">!</span>
        <p className="eyebrow">신고를 찾을 수 없어요</p>
        <h1>이 브라우저에 저장된<br />신고가 아닙니다</h1>
        <p>체험 신고는 작성한 브라우저 세션에서만 수정할 수 있습니다.</p>
        <NativeLink className="primary-button" href="/my-reports">내 신고로 돌아가기</NativeLink>
      </section>
    );
  }

  if (requestedEditId && loadedEditId !== requestedEditId) {
    return (
      <section className="auth-gate" aria-live="polite">
        <span className="lock-mark" aria-hidden="true">…</span>
        <p className="eyebrow">수정 화면 준비 중</p>
        <h1>신고 내용을<br />채우고 있어요</h1>
      </section>
    );
  }

  if (completedReport) {
    return (
      <main className="completion-page">
        <span className="completion-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">신고 완료</p>
        <h1>{editingId ? "신고를 수정했어요" : "소중한 신호를 보탰어요"}</h1>
        <p>제출한 내용은 업소 공개나 진단에 사용되지 않으며, 비식별 집계 기준을 충족할 때만 공개 신호에 반영됩니다.</p>
        <div className="completion-summary">
          <div><span>독립 신고</span><strong>1건</strong></div>
          <div><span>동행 증상자</span><strong>{completedReport.draft.partySymptomatic}명</strong></div>
        </div>
        <NativeLink className="primary-button" href="/my-reports">내 신고 확인</NativeLink>
        <NativeLink className="text-link" href="/">공개 지도로 돌아가기</NativeLink>
      </main>
    );
  }

  return (
    <main className="report-page">
      <header className="report-header">
        <NativeLink className="back-link" href="/">← 나가기</NativeLink>
        <span>{firebaseMode ? "증상 신고" : "체험 신고"}</span>
      </header>

      <ol className="stepper" aria-label="신고 진행 단계">
        {steps.map((label, index) => (
          <li className={index === step ? "active" : index < step ? "done" : ""} key={label}>
            <span>{index < step ? "✓" : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>

      <form className="report-form" noValidate onSubmit={(event) => event.preventDefault()}>
        {visibleErrors.length > 0 && <div className="report-error-summary" id="report-error-summary" role="alert" tabIndex={-1}>
          <strong>확인이 필요한 항목이 {visibleErrors.length}개 있어요</strong>
          <p>아래 메시지를 누르면 해당 입력 항목으로 이동합니다.</p>
          <ul>{visibleErrors.map((issue, index) => <li key={`${issue.field}-${index}`}><button type="button" onClick={() => jumpToError(issue)}>{issue.message}</button></li>)}</ul>
        </div>}
        {duplicateNotice && (
          <div className="duplicate-banner" role="alert">
            <strong>이미 같은 식사 신고가 있어요.</strong>
            <span>새 신고 대신 기존 내용을 불러왔습니다. 확인 후 수정해주세요.</span>
          </div>
        )}
        {step === 0 && (
          <section className="form-step" aria-labelledby="meal-title">
            <p className="eyebrow">1 · 식사 정보</p>
            <h1 id="meal-title">언제, 어디서<br />드셨나요?</h1>
            <p className="step-copy">음식점 이름과 정확한 위치는 내부 매칭에만 사용하고 공개하지 않습니다.</p>
            <div className="field-row">
              <label>식사 날짜<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("mealDate", "식사 날짜")}  required type="date" value={draft.mealDate} onInput={(e) => patch("mealDate", e.currentTarget.value)} onChange={(e) => patch("mealDate", e.target.value)} />{fieldMessage("mealDate")}</label>
              <label>식사 시간<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("mealTime", "식사 시간")}  required type="time" value={draft.mealTime} onInput={(e) => patch("mealTime", e.currentTarget.value)} onChange={(e) => patch("mealTime", e.target.value)} />{fieldMessage("mealTime")}</label>
            </div>


            <div className="restaurant-search">
              <label htmlFor="restaurant-query">{manualRestaurant ? "음식점 상호명 직접 입력" : "음식점 먼저 검색"}<span className="required-mark" aria-hidden="true">필수</span></label>
              <p className="restaurant-search-help" id="restaurant-search-help">{manualRestaurant ? "식사한 지역과 상호명을 직접 입력해주세요." : "지역 선택 없이 음식점 이름부터 검색하세요. 지점명이나 지역명을 함께 입력하면 찾기 쉬워요."}</p>
              <div className="restaurant-search-control">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m15 15 6 6" stroke="currentColor" strokeWidth="2" /></svg>
                <input
                  {...fieldAttrs("restaurantInternalId", "음식점 찾기")}
                  aria-describedby={`restaurant-search-help${fieldError("restaurantInternalId") ? " error-restaurantInternalId" : ""}`}
                  aria-controls="restaurant-results"
                  autoComplete="off"
                  placeholder={manualRestaurant ? "음식점 상호명을 입력하세요" : "예: 교동면옥 용인영덕점"}
                  type="search"
                  value={draft.restaurantDisplayInput}
                  onKeyDown={(e) => { if (e.key === "Enter" && !manualRestaurant) { e.preventDefault(); patch("restaurantInternalId", ""); setSearchAttempt((n) => n + 1); } }}
                  onChange={(e) => {
                    regionRequest.current?.abort();
                    setRegionStatus("");
                    patch("restaurantDisplayInput", e.target.value);
                    patch("restaurantInternalId", manualRestaurant ? (draft.restaurantInternalId || `manual_${Date.now()}`) : "");
                  }}
                />
                {!manualRestaurant && <button type="button" disabled={draft.restaurantDisplayInput.trim().length < 2} onClick={() => { patch("restaurantInternalId", ""); setSearchAttempt((n) => n + 1); }}>검색</button>}
              </div>
              {fieldMessage("restaurantInternalId")}
              {!manualRestaurant && candidates.length > 0 && !draft.restaurantInternalId && (
                <div className="candidate-list" id="restaurant-results" role="listbox" aria-label="음식점 검색 결과">
                  {candidates.map((candidate) => (
                    <button
                      aria-selected="false"
                      key={candidate.internalId}
                      onClick={() => void selectRestaurant(candidate)}
                      role="option"
                      type="button"
                    >
                      <strong>{candidate.name}<span className="candidate-select-label">선택</span></strong>
                      <span>{candidate.address} · {candidate.categoryLabel || candidate.category}{candidate.phone ? ` · ${candidate.phone}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
              {draft.restaurantInternalId && <p className="matched-note">✓ {draft.restaurantInternalId.startsWith("manual_") ? "직접 입력됨 · 장소 확인 후 집계됩니다" : "음식점 선택 완료 · 외부에는 공개되지 않아요"}</p>}
              {!manualRestaurant && !draft.restaurantInternalId && activeRestaurantSearch.status === "loading" && <p className="restaurant-search-status">카카오 장소에서 음식점을 검색하는 중입니다.</p>}
              {!manualRestaurant && !draft.restaurantInternalId && activeRestaurantSearch.status === "error" && <p className="restaurant-search-status error">{activeRestaurantSearch.message}</p>}
              {!manualRestaurant && !draft.restaurantInternalId && activeRestaurantSearch.status === "loaded" && candidates.length === 0 && <p className="restaurant-search-status" role="status">검색 결과가 없습니다. 지역이나 상호명을 다시 확인해주세요.</p>}
              <button className="manual-place" type="button" onClick={() => {
                regionRequest.current?.abort(); setRegionStatus("");
                setManualRestaurant(!manualRestaurant);
                setDraft((current) => ({ ...current, restaurantInternalId: manualRestaurant ? "" : `manual_${Date.now()}` }));
              }}>{manualRestaurant ? "음식점 검색으로 돌아가기" : "검색에 없나요? 지역·상호명 직접 입력"}</button>
            </div>
            {regionStatus && <p className="matched-note" role="status">{regionStatus}</p>}
            <ReportRegionSelect value={draft} errors={visibleErrors} onChange={(region) => {
              regionRequest.current?.abort(); setRegionStatus("");
              setDraft((current) => ({ ...current, ...region }));
            }} />

            <label>음식 유형<span className="required-mark" aria-hidden="true">필수</span>
              <select {...fieldAttrs("foodCategory", "음식 유형")}  value={draft.foodCategory} onChange={(e) => {
                patch("foodCategory", e.target.value as ReportDraft["foodCategory"]);
                if (e.target.value !== "기타") patch("foodCategoryDetail", "");
              }}>
                <option value="">선택해주세요</option>
                {FOOD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            {fieldMessage("foodCategory")}</label>
            {draft.foodCategory === "기타" && <label>음식 유형 직접 입력<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("foodCategoryDetail", "음식 유형 직접 입력")}  maxLength={50} placeholder="예: 밀키트, 푸드트럭" value={draft.foodCategoryDetail} onChange={(e) => patch("foodCategoryDetail", e.target.value)} />{fieldMessage("foodCategoryDetail")}</label>}
            <label>먹은 메뉴<input {...fieldAttrs("menu", "먹은 메뉴")}  maxLength={100} placeholder="예: 물냉면, 만두" value={draft.menu} onChange={(e) => patch("menu", e.target.value)} />{fieldMessage("menu")}</label>
            <fieldset className="field-block" {...fieldAttrs("serviceMode", "이용 방식")} tabIndex={-1}>
              <legend>이용 방식 <span className="required-mark" aria-hidden="true">필수</span></legend>
              <div className="service-mode">
                {(["dine_in", "delivery", "takeout"] as const).map((mode) => (
                  <button aria-pressed={draft.serviceMode === mode} className={draft.serviceMode === mode ? "selected" : ""} key={mode} onClick={() => patch("serviceMode", mode)} type="button">
                    {mode === "dine_in" ? "매장" : mode === "delivery" ? "배달" : "포장"}
                  </button>
                ))}
              </div>
              {fieldMessage("serviceMode")}
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="form-step" aria-labelledby="symptom-title">
            <p className="eyebrow">2 · 증상</p>
            <h1 id="symptom-title">어떤 증상이<br />있었나요?</h1>
            <p className="step-copy">이 설문은 식중독 여부를 진단하지 않습니다.</p>
            <ToggleGroup fieldProps={fieldAttrs("symptoms", "증상 선택")} error={fieldMessage("symptoms")} label="해당하는 증상을 모두 선택해주세요" options={symptomOptions} values={draft.symptoms} onChange={(value) => patch("symptoms", value)} />
            {draft.symptoms.includes("설사") && (
              <label>하루 설사 횟수<input {...fieldAttrs("diarrheaCount", "하루 설사 횟수")}  min={0} max={50} type="number" value={draft.diarrheaCount} onChange={(e) => patch("diarrheaCount", Number(e.target.value))} />{fieldMessage("diarrheaCount")}</label>
            )}
            <label>기타 증상<textarea {...fieldAttrs("otherSymptom", "기타 증상")}  maxLength={300} placeholder="추가 증상이 있다면 적어주세요" value={draft.otherSymptom} onChange={(e) => patch("otherSymptom", e.target.value)} />{fieldMessage("otherSymptom")}</label>
            <div className="field-row">
              <label>최초 증상 날짜<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("onsetDate", "최초 증상 날짜")}  type="date" value={draft.onsetDate} onInput={(e) => patch("onsetDate", e.currentTarget.value)} onChange={(e) => patch("onsetDate", e.target.value)} />{fieldMessage("onsetDate")}</label>
              <label>최초 증상 시간<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("onsetTime", "최초 증상 시간")}  type="time" value={draft.onsetTime} onInput={(e) => patch("onsetTime", e.currentTarget.value)} onChange={(e) => patch("onsetTime", e.target.value)} />{fieldMessage("onsetTime")}</label>
            </div>
            <div className={`incubation-card ${incubation ? "calculated" : ""}`}>
              <span>계산된 잠복시간</span>
              <strong>{incubation ?? "식사와 증상 시간을 입력하면 계산돼요"}</strong>
            </div>
            {(draft.symptoms.includes("혈변") || draft.symptoms.includes("발열")) && (
              <div className="medical-alert"><strong>의료기관 확인이 필요한 증상일 수 있어요.</strong><span>증상이 심하거나 지속되면 가까운 의료기관에 문의해주세요.</span></div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="form-step" aria-labelledby="party-title">
            <p className="eyebrow">3 · 동행자</p>
            <h1 id="party-title">같이 드신 분도<br />아팠나요?</h1>
            <p className="step-copy">동행 증상자는 여러 명이어도 독립 신고 1건과 분리해 집계합니다.</p>
            <div className="field-row">
              <label>나를 포함한 총 인원<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("partyTotal", "나를 포함한 총 인원")}  min={1} max={100} type="number" value={draft.partyTotal} onChange={(e) => {
                const total = Math.min(100, Math.max(1, Number(e.target.value)));
                setDraft((current) => ({
                  ...current,
                  partyTotal: total,
                  partySymptomatic: Math.min(current.partySymptomatic, total - 1),
                  companions: current.companions.slice(0, Math.min(current.partySymptomatic, total - 1)),
                }));
              }} />{fieldMessage("partyTotal")}</label>
              <label>나 외 증상자<span className="required-mark" aria-hidden="true">필수</span><input {...fieldAttrs("partySymptomatic", "나 외 증상자")}  min={0} max={Math.max(0, draft.partyTotal - 1)} type="number" value={draft.partySymptomatic} onChange={(e) => setCompanionCount(Number(e.target.value))} />{fieldMessage("partySymptomatic")}</label>
            </div>
            <div className="party-summary">
              <div><span>독립 신고</span><strong>1건</strong></div>
              <div><span>동행 증상자</span><strong>{draft.partySymptomatic}명</strong></div>
              <div><span>총 증상자</span><strong>{1 + draft.partySymptomatic}명</strong></div>
            </div>
            {draft.partySymptomatic > 0 && (
              <div className="companion-list">
                <div className="companion-list-heading"><strong>동행 증상자별 정보</strong><span>{draft.companions.length}명</span></div>
                <p className="companion-privacy-note">이름과 생년월일은 받지 않습니다. 나이는 만 나이로 입력하며, 모르는 항목은 비워둘 수 있어요.</p>
                {draft.companions.map((companion, index) => (
                  <article className="companion-card" key={index}>
                    <div className="companion-card-heading"><strong>동행자 {index + 1}</strong><span>증상자</span></div>
                    <div className="field-row">
                      <label>나이 (선택)<input {...fieldAttrs(`companion-age-${index}`, `동행자 ${index + 1} 나이`)} inputMode="numeric" max={120} min={0} placeholder="만 나이" type="number" value={companion.age} onChange={(e) => patchCompanion(index, "age", e.target.value === "" ? "" : Number(e.target.value))} />{fieldMessage(`companion-age-${index}`)}</label>
                      <label>성별 (선택)<select value={companion.gender} onChange={(e) => patchCompanion(index, "gender", e.target.value as CompanionDraft["gender"])}><option value="">선택하지 않음</option>{COMPANION_GENDERS.map((gender) => <option key={gender} value={gender}>{genderLabels[gender]}</option>)}</select></label>
                    </div>
                    <ToggleGroup label={`동행자 ${index + 1} 증상`} options={symptomOptions} values={companion.symptoms} onChange={(value) => patchCompanion(index, "symptoms", value)} />
                    <label>기타 증상<textarea maxLength={300} placeholder="목록에 없는 증상이 있다면 입력" value={companion.otherSymptom} onChange={(e) => patchCompanion(index, "otherSymptom", e.target.value)} /></label>
                    <label>증상 시작시간 (선택)<input type="datetime-local" value={companion.onsetAt} onChange={(e) => patchCompanion(index, "onsetAt", e.target.value)} /></label>
                    <ToggleGroup label="기저질환 (선택)" options={[...UNDERLYING_CONDITIONS]} values={companion.underlyingConditions} onChange={(value) => patchCompanion(index, "underlyingConditions", value as CompanionDraft["underlyingConditions"])} />
                    {companion.underlyingConditions.includes("기타") && <label>기타 기저질환<input maxLength={100} placeholder="진단명만 간단히 입력" value={companion.otherUnderlyingCondition} onChange={(e) => patchCompanion(index, "otherUnderlyingCondition", e.target.value)} /></label>}
                    <div className="field-row">
                      <YesNo label="병원 방문" value={companion.medicalVisit} onChange={(value) => patchCompanion(index, "medicalVisit", value)} />
                      <YesNo label="검사 여부" value={companion.tested} onChange={(value) => patchCompanion(index, "tested", value)} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="form-step" aria-labelledby="medical-title">
            <p className="eyebrow">4 · 의료정보와 확인</p>
            <h1 id="medical-title">마지막으로<br />확인해주세요</h1>
            <p className="step-copy">MVP에서는 병원 서류나 검사결과 원본을 받지 않습니다.</p>
            <div className="medical-grid">
              <YesNo label="병원에 방문했나요?" value={draft.medicalVisit} onChange={(value) => patch("medicalVisit", value)} />
              <YesNo label="입원했나요?" value={draft.hospitalized} onChange={(value) => patch("hospitalized", value)} />
              <YesNo label="대변검사 등을 했나요?" value={draft.tested} onChange={(value) => patch("tested", value)} />
              <YesNo label="병원체를 확인했나요?" value={draft.pathogenKnown} onChange={(value) => patch("pathogenKnown", value)} />
            </div>
            {draft.pathogenKnown && <label>병원체 종류(선택)<input maxLength={80} value={draft.pathogenType} onChange={(e) => patch("pathogenType", e.target.value)} /></label>}

            <div className="review-card">
              <div><span>식사</span><strong>{draft.mealDate || "미입력"} {draft.mealTime}</strong></div>
              <div><span>음식점</span><strong>{draft.restaurantDisplayInput || "미입력"}<small>내부에서만 확인</small></strong></div>
              <div><span>증상</span><strong>{draft.symptoms.join(", ") || "미선택"}</strong></div>
              <div><span>잠복시간</span><strong>{incubation ?? "계산 전"}</strong></div>
              <div><span>인원 집계</span><strong>독립 1건 · 동행 {draft.partySymptomatic}명<small>개별정보 {draft.companions.length}명 입력</small></strong></div>
            </div>
            <label className="consent-check"><input {...fieldAttrs("consent", "건강정보 처리 동의")} checked={consented} onChange={(event) => setConsented(event.target.checked)} type="checkbox" /> <span>건강 관련 정보가 민감정보임을 확인했으며, 신고 분석 목적으로 처리하는 데 동의합니다. <small>실제 운영 전 동의문과 보유기간을 법률 검토합니다.</small></span></label>
            {fieldMessage("consent")}
            <button
              className="submit-preview"
              disabled={submitting}
              onClick={() => void submitReport()}
              type="button"
            >
              {submitting ? "저장 중..." : editingId ? "기존 신고 수정하기" : "증상 신고 제출하기"}
            </button>
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
          </section>
        )}

        <div className="wizard-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">이전</button>
          {step < steps.length - 1 && <button className="primary-button" onClick={nextStep} type="button">다음</button>}
        </div>
      </form>
    </main>
  );
}
