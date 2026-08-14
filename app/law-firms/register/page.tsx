"use client";

import { useState, type FormEvent } from "react";
import { NativeLink } from "../../native-link";
import { firebaseAuthHeaders } from "../../firebase/auth-header";
import type { LawFirmApplicationInput } from "../types";
import { readJsonResponse } from "../../http-response";

const initialForm: LawFirmApplicationInput = {
  firmName: "", branchName: "", representativeLawyer: "", barRegistrationNumber: "", phone: "", website: "", address: "", region: "",
  consultationModes: ["방문"], introduction: "",
  experience: { evidenceType: "case_number", courtName: "", caseNumber: "", precedentUrl: "", eventRegion: "", eventMonth: "", victimCountBand: "", caseCount: 1 },
};

export default function LawFirmRegisterPage() {
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; message: string }>({ status: "idle", message: "" });
  const field = (key: keyof Omit<LawFirmApplicationInput, "consultationModes" | "experience">, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const experience = (key: keyof LawFirmApplicationInput["experience"], value: string | number) => setForm((current) => ({ ...current, experience: { ...current.experience, [key]: value } }));
  const toggleMode = (mode: string) => setForm((current) => ({ ...current, consultationModes: current.consultationModes.includes(mode) ? current.consultationModes.filter((item) => item !== mode) : [...current.consultationModes, mode] }));

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
          <div className="legal-field-row"><label>로펌·법률사무소 이름<input required value={form.firmName} onChange={(e) => field("firmName", e.target.value)} /></label><label>지점명 (선택)<input value={form.branchName} onChange={(e) => field("branchName", e.target.value)} /></label></div>
          <div className="legal-field-row"><label>담당 변호사 이름<input required value={form.representativeLawyer} onChange={(e) => field("representativeLawyer", e.target.value)} /></label><label>변호사 등록번호 <small>비공개</small><input required value={form.barRegistrationNumber} onChange={(e) => field("barRegistrationNumber", e.target.value)} /></label></div>
          <div className="legal-field-row"><label>대표 전화번호<input required inputMode="tel" value={form.phone} onChange={(e) => field("phone", e.target.value)} /></label><label>홈페이지<input required type="url" placeholder="https://" value={form.website} onChange={(e) => field("website", e.target.value)} /></label></div>
          <label>사무실 주소<input required value={form.address} onChange={(e) => field("address", e.target.value)} /></label><label>주요 상담 가능 지역<input required placeholder="예: 전국, 서울·경기" value={form.region} onChange={(e) => field("region", e.target.value)} /></label>
          <div className="consult-mode"><span>상담 방식</span>{["방문", "전화", "화상"].map((mode) => <button className={form.consultationModes.includes(mode) ? "selected" : ""} key={mode} onClick={() => toggleMode(mode)} type="button">{mode}</button>)}</div>
          <label>사무소 소개 (선택)<textarea maxLength={500} value={form.introduction} onChange={(e) => field("introduction", e.target.value)} /></label>
        </fieldset>

        <fieldset><legend><span>2</span>식중독 사건 수임경력</legend>
          <p className="private-evidence-note"><strong>증빙은 비공개로 보관합니다.</strong> 당사자 이름·주민번호·의료정보는 입력하지 마세요.</p>
          <div className="evidence-mode"><button className={form.experience.evidenceType === "case_number" ? "selected" : ""} onClick={() => experience("evidenceType", "case_number")} type="button"><strong>사건번호로 확인</strong><span>법원과 사건번호가 있는 경우</span></button><button className={form.experience.evidenceType === "summary" ? "selected" : ""} onClick={() => experience("evidenceType", "summary")} type="button"><strong>익명 정보로 제출</strong><span>사건번호를 입력할 수 없는 경우</span></button></div>
          {form.experience.evidenceType === "case_number" ? <>
            <div className="legal-field-row"><label>법원명<input required value={form.experience.courtName} onChange={(e) => experience("courtName", e.target.value)} /></label><label>사건번호 <small>비공개</small><input required placeholder="예: 2024가단12345" value={form.experience.caseNumber} onChange={(e) => experience("caseNumber", e.target.value)} /></label></div>
            <label>공개 판결 URL (선택)<input type="url" placeholder="https://portal.scourt.go.kr/..." value={form.experience.precedentUrl} onChange={(e) => experience("precedentUrl", e.target.value)} /></label>
          </> : <>
            <div className="legal-field-row"><label>사건 발생 지역<input required placeholder="시·군·구까지만" value={form.experience.eventRegion} onChange={(e) => experience("eventRegion", e.target.value)} /></label><label>사건 발생 월<input required type="month" value={form.experience.eventMonth} onChange={(e) => experience("eventMonth", e.target.value)} /></label></div>
            <label>피해자 수 구간<select required value={form.experience.victimCountBand} onChange={(e) => experience("victimCountBand", e.target.value)}><option value="">선택</option><option>1명</option><option>2~5명</option><option>6~20명</option><option>21명 이상</option></select></label>
          </>}
          <label>식중독 관련 수임 사건 수<input min={1} max={999} required type="number" value={form.experience.caseCount} onChange={(e) => experience("caseCount", Number(e.target.value))} /></label>
        </fieldset>
        <label className="registration-consent"><input required type="checkbox" /><span>입력 내용이 사실이며, 관리자 확인 과정에서 추가 증빙을 요청할 수 있음에 동의합니다. 등록은 추천·승소 보증이 아닙니다.</span></label>
        {state.message && <p className={`registration-state ${state.status}`}>{state.message}</p>}
        <button className="registration-submit" disabled={state.status === "sending"} type="submit">{state.status === "sending" ? "접수 중…" : "검증 신청하기"}</button>
      </form>
    </main>
  );
}
