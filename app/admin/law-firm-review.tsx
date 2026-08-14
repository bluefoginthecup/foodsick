"use client";

import { useCallback, useEffect, useState } from "react";
import { firebaseAuthHeaders } from "../firebase/auth-header";

type ReviewApplication = {
  id: string;
  firmName: string;
  branchName: string;
  representativeLawyer: string;
  barRegistrationNumber: string;
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
};

export function LawFirmReviewPanel() {
  const [applications, setApplications] = useState<ReviewApplication[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setState("loading");
    void firebaseAuthHeaders().then((headers) => fetch("/api/law-firms/admin", { headers })).then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = await response.json() as { applications: ReviewApplication[] };
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

  if (state === "loading") return <section className="admin-panel-state">로펌 등록 신청을 불러오는 중입니다.</section>;
  if (state === "error") return <section className="admin-panel-state error">목록을 불러오지 못했습니다.<button onClick={load} type="button">다시 시도</button></section>;
  if (!applications.length) return <section className="admin-panel-state">아직 접수된 로펌 등록 신청이 없습니다.</section>;

  return <section className="firm-review-list" aria-label="로펌 등록 검증 목록">{applications.map((item) => (
    <article key={item.id}>
      <div className="firm-review-title"><div><span className={`firm-review-status ${item.status}`}>{item.status}</span><h2>{item.firmName} {item.branchName}</h2><p>{item.representativeLawyer} 변호사 · {item.region}</p></div><time>{new Date(item.createdAt).toLocaleDateString("ko-KR")}</time></div>
      <dl><div><dt>변호사 등록번호</dt><dd>{item.barRegistrationNumber}</dd></div><div><dt>연락처</dt><dd>{item.phone}</dd></div><div><dt>주소</dt><dd>{item.address}</dd></div><div><dt>수임 사건</dt><dd>{item.experience.caseCount}건</dd></div></dl>
      <div className="evidence-review">
        <strong>{item.experience.evidenceType === "case_number" ? "사건번호 증빙" : "익명 경력정보"}</strong>
        {item.experience.evidenceType === "case_number" ? <p>{item.experience.courtName} · {item.experience.caseNumber}{item.experience.precedentUrl && <> · <a href={item.experience.precedentUrl} rel="noreferrer" target="_blank">공개 판결 ↗</a></>}</p> : <p>{item.experience.eventRegion} · {item.experience.eventMonth} · 피해자 {item.experience.victimCountBand}</p>}
      </div>
      <label className="review-note">검토 메모<input onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="추가 확인사항 또는 반려 사유" value={notes[item.id] ?? item.reviewNote} /></label>
      <div className="firm-review-actions"><button onClick={() => void review(item.id, "verified")} type="button">검증 완료·공개</button><button onClick={() => void review(item.id, "rejected")} type="button">반려</button><a href={item.website} rel="noreferrer" target="_blank">홈페이지 확인 ↗</a></div>
    </article>
  ))}</section>;
}
