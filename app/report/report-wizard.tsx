"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FOOD_CATEGORIES, type ReportDraft } from "../contracts";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { findRestaurantCandidates, restaurantCandidates } from "./restaurant-matcher";
import { useReports, type StoredReport } from "../reports/report-store";

const symptomOptions = ["설사", "구토", "복통", "발열", "오한", "혈변", "두통", "근육통"];
const steps = ["식사", "증상", "동행", "의료·확인"];

const initialDraft: ReportDraft = {
  mealDate: "",
  mealTime: "",
  province: "경기도",
  city: "용인시",
  district: "기흥구 영덕동",
  restaurantInternalId: "",
  restaurantDisplayInput: "",
  foodCategory: "",
  menu: "",
  serviceMode: "",
  symptoms: [],
  diarrheaCount: 0,
  otherSymptom: "",
  onsetDate: "",
  onsetTime: "",
  partyTotal: 1,
  partySymptomatic: 0,
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

function ToggleGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="field-block">
      <legend>{label}</legend>
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
  const candidates = useMemo(() => findRestaurantCandidates(draft.restaurantDisplayInput), [draft.restaurantDisplayInput]);
  const incubation = calculateIncubation(draft);

  /* The report store is restored after hydration, so edit data must be applied afterwards. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!requestedEditId || !sessionRestored || !user || loadedEditId === requestedEditId) return;
    if (!requestedReport || requestedReport.ownerUid !== user.uid) return;
    setLoadedEditId(requestedEditId);
    setDraft(structuredClone(requestedReport.draft));
    setEditingId(requestedReport.id);
    setStep(3);
    setConsented(false);
    setDuplicateNotice(false);
    setCompletedReport(null);
  }, [loadedEditId, requestedEditId, requestedReport, sessionRestored, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const patch = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
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
        <span>체험 신고</span>
      </header>

      <ol className="stepper" aria-label="신고 진행 단계">
        {steps.map((label, index) => (
          <li className={index === step ? "active" : index < step ? "done" : ""} key={label}>
            <span>{index < step ? "✓" : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>

      <form className="report-form" onSubmit={(event) => event.preventDefault()}>
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
              <label>식사 날짜<input required type="date" value={draft.mealDate} onChange={(e) => patch("mealDate", e.target.value)} /></label>
              <label>식사 시간<input required type="time" value={draft.mealTime} onChange={(e) => patch("mealTime", e.target.value)} /></label>
            </div>
            <div className="field-row region-row">
              <label>시/도<input value={draft.province} onChange={(e) => patch("province", e.target.value)} /></label>
              <label>시/군/구<input value={draft.city} onChange={(e) => patch("city", e.target.value)} /></label>
            </div>
            <label>읍/면/동<input value={draft.district} onChange={(e) => patch("district", e.target.value)} /></label>

            <div className="restaurant-search">
              <label>음식점 상호명
                <input
                  autoComplete="off"
                  placeholder="예: 교동면옥 용인영덕점"
                  value={draft.restaurantDisplayInput}
                  onChange={(e) => {
                    patch("restaurantDisplayInput", e.target.value);
                    patch("restaurantInternalId", "");
                  }}
                />
              </label>
              {candidates.length > 0 && !draft.restaurantInternalId && (
                <div className="candidate-list" role="listbox" aria-label="음식점 검색 결과">
                  {candidates.map((candidate) => (
                    <button
                      aria-selected="false"
                      key={candidate.internalId}
                      onClick={() => setDraft((current) => ({
                        ...current,
                        restaurantInternalId: candidate.internalId,
                        restaurantDisplayInput: candidate.name,
                        foodCategory: candidate.category as ReportDraft["foodCategory"],
                      }))}
                      role="option"
                      type="button"
                    >
                      <strong>{candidate.name}</strong>
                      <span>{candidate.address} · {candidate.category}</span>
                    </button>
                  ))}
                </div>
              )}
              {draft.restaurantInternalId && <p className="matched-note">✓ 지도 장소와 내부 연결됨 · 외부에는 공개되지 않아요</p>}
              {draft.restaurantDisplayInput.length >= 2 && candidates.length === 0 && (
                <button className="manual-place" onClick={() => patch("restaurantInternalId", `manual_${Date.now()}`)} type="button">검색 결과 없이 직접 입력으로 계속</button>
              )}
            </div>

            <label>음식 유형
              <select value={draft.foodCategory} onChange={(e) => patch("foodCategory", e.target.value as ReportDraft["foodCategory"])}>
                <option value="">선택해주세요</option>
                {FOOD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>먹은 메뉴<input maxLength={100} placeholder="예: 물냉면, 만두" value={draft.menu} onChange={(e) => patch("menu", e.target.value)} /></label>
            <fieldset className="field-block">
              <legend>이용 방식</legend>
              <div className="service-mode">
                {(["dine_in", "delivery", "takeout"] as const).map((mode) => (
                  <button aria-pressed={draft.serviceMode === mode} className={draft.serviceMode === mode ? "selected" : ""} key={mode} onClick={() => patch("serviceMode", mode)} type="button">
                    {mode === "dine_in" ? "매장" : mode === "delivery" ? "배달" : "포장"}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="form-step" aria-labelledby="symptom-title">
            <p className="eyebrow">2 · 증상</p>
            <h1 id="symptom-title">어떤 증상이<br />있었나요?</h1>
            <p className="step-copy">이 설문은 식중독 여부를 진단하지 않습니다.</p>
            <ToggleGroup label="해당하는 증상을 모두 선택해주세요" options={symptomOptions} values={draft.symptoms} onChange={(value) => patch("symptoms", value)} />
            {draft.symptoms.includes("설사") && (
              <label>하루 설사 횟수<input min={0} max={50} type="number" value={draft.diarrheaCount} onChange={(e) => patch("diarrheaCount", Number(e.target.value))} /></label>
            )}
            <label>기타 증상<textarea maxLength={300} placeholder="추가 증상이 있다면 적어주세요" value={draft.otherSymptom} onChange={(e) => patch("otherSymptom", e.target.value)} /></label>
            <div className="field-row">
              <label>최초 증상 날짜<input type="date" value={draft.onsetDate} onChange={(e) => patch("onsetDate", e.target.value)} /></label>
              <label>최초 증상 시간<input type="time" value={draft.onsetTime} onChange={(e) => patch("onsetTime", e.target.value)} /></label>
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
              <label>나를 포함한 총 인원<input min={1} max={100} type="number" value={draft.partyTotal} onChange={(e) => patch("partyTotal", Math.max(1, Number(e.target.value)))} /></label>
              <label>나 외 증상자<input min={0} max={Math.max(0, draft.partyTotal - 1)} type="number" value={draft.partySymptomatic} onChange={(e) => patch("partySymptomatic", Math.max(0, Number(e.target.value)))} /></label>
            </div>
            <div className="party-summary">
              <div><span>독립 신고</span><strong>1건</strong></div>
              <div><span>동행 증상자</span><strong>{draft.partySymptomatic}명</strong></div>
              <div><span>총 증상자</span><strong>{1 + draft.partySymptomatic}명</strong></div>
            </div>
            {draft.partySymptomatic > 0 && (
              <>
                <ToggleGroup label="동행자에게 나타난 증상" options={symptomOptions} values={draft.companionSymptoms} onChange={(value) => patch("companionSymptoms", value)} />
                <label>동행자 증상 시작시간<input type="datetime-local" value={draft.companionOnsetAt} onChange={(e) => patch("companionOnsetAt", e.target.value)} /></label>
                <div className="field-row">
                  <YesNo label="동행자 병원 방문" value={draft.companionMedicalVisit} onChange={(value) => patch("companionMedicalVisit", value)} />
                  <YesNo label="동행자 검사" value={draft.companionTested} onChange={(value) => patch("companionTested", value)} />
                </div>
              </>
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
              <div><span>인원 집계</span><strong>독립 1건 · 동행 {draft.partySymptomatic}명</strong></div>
            </div>
            <label className="consent-check"><input checked={consented} onChange={(event) => setConsented(event.target.checked)} type="checkbox" /> <span>건강 관련 정보가 민감정보임을 확인했으며, 신고 분석 목적으로 처리하는 데 동의합니다. <small>실제 운영 전 동의문과 보유기간을 법률 검토합니다.</small></span></label>
            <button
              className="submit-preview"
              disabled={!consented || !draft.restaurantInternalId || !draft.mealDate || !draft.mealTime || draft.symptoms.length === 0}
              onClick={() => {
                if (editingId) {
                  const updated = updateReport(editingId, user.uid, draft);
                  if (updated) setCompletedReport(updated);
                  return;
                }
                const result = createReport(user.uid, draft);
                if (result.kind === "duplicate") {
                  setDraft(structuredClone(result.report.draft));
                  setEditingId(result.report.id);
                  setDuplicateNotice(true);
                  setConsented(false);
                  return;
                }
                setCompletedReport(result.report);
              }}
              type="button"
            >
              {editingId ? "기존 신고 수정하기" : "증상 신고 제출하기"}
            </button>
          </section>
        )}

        <div className="wizard-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">이전</button>
          {step < steps.length - 1 && <button className="primary-button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} type="button">다음</button>}
        </div>
      </form>
      <details className="mock-helper">
        <summary>체험용 음식점 검색어</summary>
        <p>{restaurantCandidates.map((candidate) => candidate.name).join(" · ")}</p>
      </details>
    </main>
  );
}
