"use client";
import { useI18n } from "../i18n/context";


import { useCallback, useEffect, useState } from "react";
import { firebaseAuthHeaders } from "../firebase/auth-header";
import { readJsonResponse } from "../http-response";

type ReviewApplication = {
  id: string;
  firmName: string;
  branchName: string;
  representativeLawyer: string;
  barRegistrationNumber: string;
  lawyers?: Array<{ name: string; barRegistrationNumber: string }>;
  phone: string;
  website: string;
  address: string;
  region: string;
  status: "pending" | "verified" | "rejected";
  reviewNote: string;
  createdAt: string;
  experience: {
    evidenceType: "case_number" | "summary";
    courtName: string;
    caseNumber: string;
    precedentUrl: string;
    eventRegion: string;
    eventMonth: string;
    victimCountBand: string;
    caseCount: number;
  };
  experiences?: Array<{
    evidenceType: "case_number" | "summary";
    courtName: string;
    caseNumber: string;
    precedentUrl: string;
    eventRegion: string;
    eventMonth: string;
    victimCountBand: string;
    caseCount: number;
  }>;
};

export function LawFirmReviewPanel() {
  const { t, text, locale } = useI18n();
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setState("loading");
    void firebaseAuthHeaders().then((headers) => fetch("/api/law-firms/admin", { headers })).then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = await readJsonResponse<{ applications: ReviewApplication[] }>(response, "등록 신청 목록을 불러오지 못했습니다");
        setApplications(payload.applications);
        setState("loaded");
      }).catch(() => setState("error"));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const review = async (id: string, status: "verified" | "rejected") => {
    const authHeaders = await firebaseAuthHeaders();
    const response = await fetch("/api/law-firms/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ id, status, note: notes[id] ?? "" }),
    });
    if (response.ok) load();
    else setState("error");
  };

  if (state === "loading") return <section className="admin-panel-state">{t("로펌 등록 신청을 불러오는 중입니다.")}</section>;
  if (state === "error") return <section className="admin-panel-state error">{t("목록을 불러오지 못했습니다.")}<button onClick={load} type="button">{t("다시 시도")}</button></section>;
  if (!applications.length) return <section className="admin-panel-state">{t("아직 접수된 로펌 등록 신청이 없습니다.")}</section>;

  return <section className="firm-review-list" aria-label={t("로펌 등록 검증 목록")}>{text(applications.map((item) => (
    <article key={item.id}>
      <div className="firm-review-title"><div><span className={`firm-review-status ${item.status}`}>{text(item.status)}</span><h2>{item.firmName} {item.branchName}</h2><p>{item.representativeLawyer}{t(" 변호사 · ")}{item.region}</p></div><time>{text(new Date(item.createdAt).toLocaleDateString(locale))}</time></div>
      <dl><div><dt>{t("소속 변호사")}</dt><dd>{text(item.lawyers?.length || 1)}{t("명")}</dd></div><div><dt>{t("연락처")}</dt><dd>{text(item.phone)}</dd></div><div><dt>{t("주소")}</dt><dd>{text(item.address)}</dd></div><div><dt>{t("수임 사건")}</dt><dd>{text(item.experience.caseCount)}{t("건")}</dd></div></dl>
      <div className="evidence-review"><strong>{t("변호사 등록번호")}</strong>{text((item.lawyers?.length ? item.lawyers : [{ name: item.representativeLawyer, barRegistrationNumber: item.barRegistrationNumber }]).map((lawyer, index) => <p key={`${lawyer.barRegistrationNumber}-${index}`}>{text(index + 1)}. {lawyer.name} · {text(lawyer.barRegistrationNumber)}</p>))}</div>
      <div className="evidence-review"><strong>{t("사건기록 ")}{text((item.experiences?.length || 1))}{t("건")}</strong>{text((item.experiences?.length ? item.experiences : [item.experience]).map((experience, index) => experience.evidenceType === "case_number" ? <p key={index}>{text(index + 1)}. {text(experience.courtName)} · {text(experience.caseNumber)}{text(experience.precedentUrl && <> · <a href={experience.precedentUrl} rel="noreferrer" target="_blank">{t("공개 판결 ↗")}</a></>)}</p> : <p key={index}>{text(index + 1)}. {text(experience.eventRegion)} · {text(experience.eventMonth)}{t(" · 피해자 ")}{text(experience.victimCountBand)} · {text(experience.caseCount)}{t("건")}</p>))}</div>
      <label className="review-note">{t("검토 메모")}<input onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={t("추가 확인사항 또는 반려 사유")} value={notes[item.id] ?? item.reviewNote} /></label>
      <div className="firm-review-actions"><button onClick={() => void review(item.id, "verified")} type="button">{t("검증 완료·공개")}</button><button onClick={() => void review(item.id, "rejected")} type="button">{t("반려")}</button><a href={item.website} rel="noreferrer" target="_blank">{t("홈페이지 확인 ↗")}</a></div>
    </article>
  )))}</section>;
}
