"use client";
import { useI18n } from "../../i18n/context";


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
  const { t, text } = useI18n();
  return <article className="repeat-entry-card">
    <div className="repeat-entry-heading"><strong>{t("사건기록 ")}{text(index + 1)}</strong>{text(canRemove && <button onClick={onRemove} type="button">{t("삭제")}</button>)}</div>
    <div className="evidence-mode"><button className={item.evidenceType === "case_number" ? "selected" : ""} onClick={() => onChange("evidenceType", "case_number")} type="button"><strong>{t("사건번호로 확인")}</strong><span>{t("법원과 사건번호가 있는 경우")}</span></button><button className={item.evidenceType === "summary" ? "selected" : ""} onClick={() => onChange("evidenceType", "summary")} type="button"><strong>{t("익명 정보로 제출")}</strong><span>{t("사건번호를 입력할 수 없는 경우")}</span></button></div>
    {text(item.evidenceType === "case_number" ? <>
      <div className="legal-field-row"><label>{t("법원명")}<input required value={item.courtName} onChange={(event) => onChange("courtName", event.target.value)} /></label><label>{t("사건번호 ")}<small>{t("비공개")}</small><input required placeholder={t("예: 2024가단12345")} value={item.caseNumber} onChange={(event) => onChange("caseNumber", event.target.value)} /></label></div>
      <label>{t("공개 판결 URL (선택)")}<input type="url" placeholder="https://portal.scourt.go.kr/..." value={item.precedentUrl} onChange={(event) => onChange("precedentUrl", event.target.value)} /></label>
    </> : <>
      <div className="legal-field-row"><label>{t("사건 발생 지역")}<input required placeholder={t("시·군·구까지만")} value={item.eventRegion} onChange={(event) => onChange("eventRegion", event.target.value)} /></label><label>{t("사건 발생 월")}<input required type="month" value={item.eventMonth} onChange={(event) => onChange("eventMonth", event.target.value)} /></label></div>
      <label>{t("피해자 수 구간")}<select required value={item.victimCountBand} onChange={(event) => onChange("victimCountBand", event.target.value)}><option value="">{t("선택")}</option><option value={"1명"}>{t("1명")}</option><option value={"2~5명"}>{t("2~5명")}</option><option value={"6~20명"}>{t("6~20명")}</option><option value={"21명 이상"}>{t("21명 이상")}</option></select></label>
    </>)}
    <label>{t("이 기록이 대표하는 사건 수")}<input min={1} max={999} required type="number" value={item.caseCount} onChange={(event) => onChange("caseCount", Number(event.target.value))} /></label>
  </article>;
}

export default function LawFirmRegisterPage() {
  const { t, text } = useI18n();
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

  if (state.status === "done") return <main className="firm-register-complete"><span>✓</span><p className="eyebrow">{t("접수 완료")}</p><h1>{t("검증 후 공개할게요")}</h1><p>{text(state.message)}</p><NativeLink className="primary-button" href="/law-help#firms">{t("로펌 찾기로 돌아가기")}</NativeLink></main>;

  return (
    <main className="firm-register-page">
      <section className="register-heading"><p className="eyebrow">{t("로펌·법률사무소 자발적 등록")}</p><h1>{t("식중독 사건 경험을 검증받고 등록하세요")}</h1><p>{t("사건번호와 변호사 등록번호는 관리자 검증용이며 공개 프로필에는 표시하지 않습니다.")}</p></section>
      <form className="firm-register-form" onSubmit={submit}>
        <fieldset><legend><span>1</span>{t("사무소 기본정보")}</legend>
          <div className="legal-field-row"><label>{t("로펌·법률사무소 이름")}<input required value={form.firmName} onChange={(event) => field("firmName", event.target.value)} /></label><label>{t("지점명 (선택)")}<input value={form.branchName} onChange={(event) => field("branchName", event.target.value)} /></label></div>
          <div className="legal-field-row"><label>{t("대표 전화번호")}<input required inputMode="tel" value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label><label>{t("홈페이지")}<input required type="url" placeholder="https://" value={form.website} onChange={(event) => field("website", event.target.value)} /></label></div>
          <label>{t("사무실 주소")}<input required value={form.address} onChange={(event) => field("address", event.target.value)} /></label><label>{t("주요 상담 가능 지역")}<input required placeholder={t("예: 전국, 서울·경기")} value={form.region} onChange={(event) => field("region", event.target.value)} /></label>
          <div className="consult-mode"><span>{t("상담 방식")}</span>{text(["방문", "전화", "화상"].map((mode) => <button className={form.consultationModes.includes(mode) ? "selected" : ""} key={mode} onClick={() => toggleMode(mode)} type="button">{text(mode)}</button>))}</div>
          <label>{t("사무소 소개 (선택)")}<textarea maxLength={500} value={form.introduction} onChange={(event) => field("introduction", event.target.value)} /></label>
        </fieldset>

        <fieldset><legend><span>2</span>{t("소속 변호사")}</legend>
          <div className="repeat-section-heading"><p><strong>{t("변호사 ")}{text(form.lawyers.length)}{t("명")}</strong><span>{t("등록번호는 공개되지 않습니다.")}</span></p><button disabled={form.lawyers.length >= 100} onClick={() => setForm((current) => ({ ...current, lawyers: [...current.lawyers, emptyLawyer()] }))} type="button">{t("+ 변호사 추가")}</button></div>
          <div className="repeat-entry-list">{text(form.lawyers.map((lawyer, index) => <article className="repeat-entry-card" key={index}>
            <div className="repeat-entry-heading"><strong>{t("변호사 ")}{text(index + 1)}{text(index === 0 ? " · 대표" : "")}</strong>{text(form.lawyers.length > 1 && <button onClick={() => setForm((current) => ({ ...current, lawyers: current.lawyers.filter((_, itemIndex) => itemIndex !== index) }))} type="button">{t("삭제")}</button>)}</div>
            <div className="legal-field-row"><label>{t("변호사 이름")}<input required value={lawyer.name} onChange={(event) => patchLawyer(index, "name", event.target.value)} /></label><label>{t("변호사 등록번호 ")}<small>{t("비공개")}</small><input required value={lawyer.barRegistrationNumber} onChange={(event) => patchLawyer(index, "barRegistrationNumber", event.target.value)} /></label></div>
          </article>))}</div>
        </fieldset>

        <fieldset><legend><span>3</span>{t("식중독 사건 수임경력")}</legend>
          <p className="private-evidence-note"><strong>{t("증빙은 비공개로 보관합니다.")}</strong>{t(" 당사자 이름·주민번호·의료정보는 입력하지 마세요.")}</p>
          <div className="repeat-section-heading"><p><strong>{t("사건기록 ")}{text(form.experiences.length)}{t("건")}</strong><span>{t("각 사건을 구분해 검증합니다.")}</span></p><button disabled={form.experiences.length >= 100} onClick={() => setForm((current) => ({ ...current, experiences: [...current.experiences, emptyExperience()] }))} type="button">{t("+ 사건기록 추가")}</button></div>
          <div className="repeat-entry-list">{text(form.experiences.map((item, index) => <ExperienceEditor canRemove={form.experiences.length > 1} index={index} item={item} key={index} onChange={(key, value) => patchExperience(index, key, value)} onRemove={() => setForm((current) => ({ ...current, experiences: current.experiences.filter((_, itemIndex) => itemIndex !== index) }))} />))}</div>
        </fieldset>
        <label className="registration-consent"><input required type="checkbox" /><span>{t("입력 내용이 사실이며, 관리자 확인 과정에서 추가 증빙을 요청할 수 있음에 동의합니다. 등록은 추천·승소 보증이 아닙니다.")}</span></label>
        {text(state.message && <p className={`registration-state ${state.status}`}>{text(state.message)}</p>)}
        <button className="registration-submit" disabled={state.status === "sending"} type="submit">{text(state.status === "sending" ? "접수 중…" : "검증 신청하기")}</button>
      </form>
    </main>
  );
}
