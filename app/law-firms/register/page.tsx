"use client";

import { useState, type FormEvent } from "react";
import { NativeLink } from "../../native-link";
import { firebaseAuthHeaders } from "../../firebase/auth-header";
import type { ExperienceInput, LawFirmApplicationInput, LawyerInput } from "../types";
import { readJsonResponse } from "../../http-response";

const emptyLawyer = (): LawyerInput => ({ name: "", barRegistrationNumber: "" });
const emptyExperience = (): ExperienceInput => ({ evidenceType: "case_number", courtName: "", caseNumber: "", precedentUrl: "", eventRegion: "", eventMonth: "", victimCountBand: "", caseCount: 1 });

const initialForm: LawFirmApplicationInput = {
  firmName: "", branchName: "", phone: "", website: "", address: "", region: "",
  consultationModes: ["방문"], introduction: "", lawyers: [emptyLawyer()], experiences: [emptyExperience()],
};

function ExperienceEditor({ item, index, canRemove, onChange, onRemove }: {
  item: ExperienceInput;
  index: number;
  canRemove: boolean;
  onChange: <K extends keyof ExperienceInput>(key: K, value: ExperienceInput[K]) => void;
  onRemove: () => void;
}) {
  return <article className="repeat-entry-card">
    <div className="repeat-entry-heading"><strong>사건기록 {index + 1}</strong>{canRemove && <button onClick={onRemove} type="button">삭제</button>}</div>
    <div className="evidence-mode"><button className={item.evidenceType === "case_number" ? "selected" : ""} onClick={() => onChange("evidenceType", "case_number")} type="button"><strong>사건번호로 확인</strong><span>법원과 사건번호가 있는 경우</span></button><button className={item.evidenceType === "summary" ? "selected" : ""} onClick={() => onChange("evidenceType", "summary")} type="button"><strong>익명 정보로 제출</strong><span>사건번호를 입력할 수 없는 경우</span></button></div>
    {item.evidenceType === "case_number" ? <>
      <div className="legal-field-row"><label>법원명<input required value={item.courtName} onChange={(event) => onChange("courtName", event.target.value)} /></label><label>사건번호 <small>비공개</small><input required placeholder="예: 2024가단12345" value={item.caseNumber} onChange={(event) => onChange("caseNumber", event.target.value)} /></label></div>
      <label>공개 판결 URL (선택)<input type="url" placeholder="https://portal.scourt.go.kr/..." value={item.precedentUrl} onChange={(event) => onChange("precedentUrl", event.target.value)} /></label>
    </> : <>
      <div className="legal-field-row"><label>사건 발생 지역<input required placeholder="시·군·구까지만" value={item.eventRegion} onChange={(event) => onChange("eventRegion", event.target.value)} /></label><label>사건 발생 월<input required type="month" value={item.eventMonth} onChange={(event) => onChange("eventMonth", event.target.value)} /></label></div>
      <label>피해자 수 구간<select required value={item.victimCountBand} onChange={(event) => onChange("victimCountBand", event.target.value)}><option value="">선택</option><option>1명</option><option>2~5명</option><option>6~20명</option><option>21명 이상</option></select></label>
    </>}
    <label>이 기록이 대표하는 사건 수<input min={1} max={999} required type="number" value={item.caseCount} onChange={(event) => onChange("caseCount", Number(event.target.value))} /></label>
  </article>;
}

export default function LawFirmRegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message: string }>({ status: "idle", message: "" });
  const field = (key: keyof Omit<LawFirmApplicationInput, "consultationModes" | "lawyers" | "experiences">, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggleMode = (mode: string) => setForm((current) => ({ ...current, consultationModes: current.consultationModes.includes(mode) ? current.consultationModes.filter((item) => item !== mode) : [...current.consultationModes, mode] }));
  const patchLawyer = <K extends keyof LawyerInput>(index: number, key: K, value: LawyerInput[K]) => setForm((current) => ({ ...current, lawyers: current.lawyers.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const patchExperience = <K extends keyof ExperienceInput>(index: number, key: K, value: ExperienceInput[K]) => setForm((current) => ({ ...current, experiences: current.experiences.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ status: "sending", message: "등록 내용을 안전하게 접수하는 중입니다." });
    try {
      const authHeaders = await firebaseAuthHeaders();
      const response = await fetch("/api/law-firms", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify(form) });
      const payload = await readJsonResponse<{ error?: string }>(response, "등록 신청을 접수하지 못했습니다");
      if (!response.ok) throw new Error(payload.error || "등록 신청을 접수하지 못했습니다.");
      setState({ status: "done", message: "등록 신청이 접수되었습니다. 관리자 검증 전에는 공개되지 않습니다." });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "등록 신청을 접수하지 못했습니다." });
    }
  };

  if (state.status === "done") return <main className="firm-register-complete"><span>✓</span><p className="eyebrow">접수 완료</p><h1>검증 후 공개할게요</h1><p>{state.message}</p><NativeLink className="primary-button" href="/law-help#firms">로펌 찾기로 돌아가기</NativeLink></main>;

  return (
    <main className="firm-register-page">
      <section className="register-heading"><p className="eyebrow">로펌·법률사무소 자발적 등록</p><h1>식중독 사건 경험을<br />검증받고 등록하세요</h1><p>사건번호와 변호사 등록번호는 관리자 검증용이며 공개 프로필에는 표시하지 않습니다.</p></section>
      <form className="firm-register-form" onSubmit={submit}>
        <fieldset><legend><span>1</span>사무소 기본정보</legend>
          <div className="legal-field-row"><label>로펌·법률사무소 이름<input required value={form.firmName} onChange={(event) => field("firmName", event.target.value)} /></label><label>지점명 (선택)<input value={form.branchName} onChange={(event) => field("branchName", event.target.value)} /></label></div>
          <div className="legal-field-row"><label>대표 전화번호<input required inputMode="tel" value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label><label>홈페이지<input required type="url" placeholder="https://" value={form.website} onChange={(event) => field("website", event.target.value)} /></label></div>
          <label>사무실 주소<input required value={form.address} onChange={(event) => field("address", event.target.value)} /></label><label>주요 상담 가능 지역<input required placeholder="예: 전국, 서울·경기" value={form.region} onChange={(event) => field("region", event.target.value)} /></label>
          <div className="consult-mode"><span>상담 방식</span>{["방문", "전화", "화상"].map((mode) => <button className={form.consultationModes.includes(mode) ? "selected" : ""} key={mode} onClick={() => toggleMode(mode)} type="button">{mode}</button>)}</div>
          <label>사무소 소개 (선택)<textarea maxLength={500} value={form.introduction} onChange={(event) => field("introduction", event.target.value)} /></label>
        </fieldset>

        <fieldset><legend><span>2</span>소속 변호사</legend>
          <div className="repeat-section-heading"><p><strong>변호사 {form.lawyers.length}명</strong><span>등록번호는 공개되지 않습니다.</span></p><button disabled={form.lawyers.length >= 100} onClick={() => setForm((current) => ({ ...current, lawyers: [...current.lawyers, emptyLawyer()] }))} type="button">+ 변호사 추가</button></div>
          <div className="repeat-entry-list">{form.lawyers.map((lawyer, index) => <article className="repeat-entry-card" key={index}>
            <div className="repeat-entry-heading"><strong>변호사 {index + 1}{index === 0 ? " · 대표" : ""}</strong>{form.lawyers.length > 1 && <button onClick={() => setForm((current) => ({ ...current, lawyers: current.lawyers.filter((_, itemIndex) => itemIndex !== index) }))} type="button">삭제</button>}</div>
            <div className="legal-field-row"><label>변호사 이름<input required value={lawyer.name} onChange={(event) => patchLawyer(index, "name", event.target.value)} /></label><label>변호사 등록번호 <small>비공개</small><input required value={lawyer.barRegistrationNumber} onChange={(event) => patchLawyer(index, "barRegistrationNumber", event.target.value)} /></label></div>
          </article>)}</div>
        </fieldset>

        <fieldset><legend><span>3</span>식중독 사건 수임경력</legend>
          <p className="private-evidence-note"><strong>증빙은 비공개로 보관합니다.</strong> 당사자 이름·주민번호·의료정보는 입력하지 마세요.</p>
          <div className="repeat-section-heading"><p><strong>사건기록 {form.experiences.length}건</strong><span>각 사건을 구분해 검증합니다.</span></p><button disabled={form.experiences.length >= 100} onClick={() => setForm((current) => ({ ...current, experiences: [...current.experiences, emptyExperience()] }))} type="button">+ 사건기록 추가</button></div>
          <div className="repeat-entry-list">{form.experiences.map((item, index) => <ExperienceEditor canRemove={form.experiences.length > 1} index={index} item={item} key={index} onChange={(key, value) => patchExperience(index, key, value)} onRemove={() => setForm((current) => ({ ...current, experiences: current.experiences.filter((_, itemIndex) => itemIndex !== index) }))} />)}</div>
        </fieldset>
        <label className="registration-consent"><input required type="checkbox" /><span>입력 내용이 사실이며, 관리자 확인 과정에서 추가 증빙을 요청할 수 있음에 동의합니다. 등록은 추천·승소 보증이 아닙니다.</span></label>
        {state.message && <p className={`registration-state ${state.status}`}>{state.message}</p>}
        <button className="registration-submit" disabled={state.status === "sending"} type="submit">{state.status === "sending" ? "접수 중…" : "검증 신청하기"}</button>
      </form>
    </main>
  );
}
