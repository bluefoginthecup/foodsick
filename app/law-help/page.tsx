"use client";

import { useEffect, useMemo, useState } from "react";
import { NativeLink } from "../native-link";
import type { PublicLawFirm } from "../law-firms/types";

const responseSteps = [
  { no: "01", title: "진료·검사 기록 보존", copy: "진료기록, 검사결과, 영수증과 처방전을 한곳에 보관하세요." },
  { no: "02", title: "식사·증상 시간 정리", copy: "식사 시각, 메뉴, 증상 시작 시각과 동행자의 증상을 날짜순으로 정리하세요." },
  { no: "03", title: "공식 기관에 신고", copy: "식품안전 신고 1399 또는 관할 보건소·식품위생 담당부서에 알리세요." },
  { no: "04", title: "법률상담 준비", copy: "업소와 주고받은 내용, 결제내역, 사진을 원본 그대로 준비하세요." },
];

export default function LawHelpPage() {
  const [firms, setFirms] = useState<PublicLawFirm[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [region, setRegion] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/law-firms", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const payload = await response.json() as { firms: PublicLawFirm[] };
      setFirms(payload.firms);
      setStatus("loaded");
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);

  const visibleFirms = useMemo(() => firms.filter((firm) => !region.trim()
    || `${firm.region} ${firm.address}`.toLocaleLowerCase("ko-KR").includes(region.trim().toLocaleLowerCase("ko-KR"))), [firms, region]);

  return (
    <main className="legal-page">
      <section className="legal-hero">
        <p className="eyebrow">식중독 피해 이후의 다음 단계</p>
        <h1>기록하고,<br />확인하고,<br /><em>도움을 찾으세요.</em></h1>
        <p>일반적인 대응 정보를 확인하고 공개 판례와 검증된 수임경력을 바탕으로 상담할 곳을 찾습니다.</p>
        <nav aria-label="법률지원 메뉴"><a href="#guide">대응 가이드</a><a href="#precedents">판례 보기</a><a href="#firms">로펌 찾기</a></nav>
      </section>

      <section className="legal-guide" id="guide">
        <div className="legal-section-heading"><div><p className="eyebrow">먼저 할 일</p><h2>상담 전에 준비하세요</h2></div><span>법률자문이 아닌 일반 안내입니다</span></div>
        <div className="response-step-grid">{responseSteps.map((step) => <article key={step.no}><span>{step.no}</span><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
        <div className="legal-emergency-note"><strong>합의서나 책임 면제 문구에 서명하기 전</strong><span>내용을 충분히 이해하기 어렵다면 변호사에게 먼저 확인하세요.</span></div>
      </section>

      <section className="precedent-section" id="precedents">
        <div className="legal-section-heading"><div><p className="eyebrow">공식 판결 확인</p><h2>관련 판례 보기</h2></div><a href="https://portal.scourt.go.kr" rel="noreferrer" target="_blank">법원 통합검색 ↗</a></div>
        <article className="precedent-card">
          <div><span>대법원</span><strong>2018다260299</strong></div>
          <h3>식중독 사고를 이유로 한 반품과 계약상 배상책임</h3>
          <p>식중독 발생 사실과 제품 하자에 대한 근거, 계약 문구의 합리적 해석이 쟁점이 된 사건입니다.</p>
          <a href="https://www.law.go.kr/LSW/precInfoP.do?precSeq=219829" rel="noreferrer" target="_blank">국가법령정보센터에서 판결 보기 ↗</a>
        </article>
        <div className="precedent-searches"><a href="https://portal.scourt.go.kr" rel="noreferrer" target="_blank">‘식중독 손해배상’ 판결 검색</a><a href="https://glaw.scourt.go.kr" rel="noreferrer" target="_blank">대법원 종합법률정보 검색</a></div>
        <p className="legal-source-note">판례 요약은 사건별 결과를 보장하지 않습니다. 실제 적용은 사실관계와 증거에 따라 달라집니다.</p>
      </section>

      <section className="law-firm-section" id="firms">
        <div className="legal-section-heading"><div><p className="eyebrow">광고 문구가 아닌 검증 상태</p><h2>식중독 사건 경험이 확인된 곳</h2></div><NativeLink href="/law-firms/register">로펌 등록 신청 ↗</NativeLink></div>
        <label className="firm-region-filter">지역으로 찾기<input onChange={(event) => setRegion(event.target.value)} placeholder="예: 경기, 용인, 서울" value={region} /></label>
        {status === "loading" && <div className="firm-directory-state">검증된 로펌 목록을 불러오는 중입니다.</div>}
        {status === "error" && <div className="firm-directory-state error">목록을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</div>}
        {status === "loaded" && visibleFirms.length === 0 && <div className="firm-directory-state"><strong>아직 공개된 등록 업체가 없습니다.</strong><span>관리자가 변호사 등록과 수임경력 증빙을 확인한 뒤에만 공개됩니다.</span></div>}
        <div className="law-firm-grid">{visibleFirms.map((firm) => (
          <article className="law-firm-card" key={firm.id}>
            <div className="verified-line"><span>수임경력 확인됨</span><small>{new Date(firm.verifiedAt).toLocaleDateString("ko-KR")} 확인</small></div>
            <h3>{firm.firmName}{firm.branchName && <small>{firm.branchName}</small>}</h3>
            <p>{firm.representativeLawyer} 변호사 · {firm.region}</p>
            <dl><div><dt>식중독 관련 사건</dt><dd>{firm.experience.caseCount}건</dd></div><div><dt>증빙</dt><dd>{firm.experience.publicCaseReference}</dd></div>{firm.experience.eventRegion && <div><dt>사건 지역</dt><dd>{firm.experience.eventRegion}</dd></div>}</dl>
            <div className="firm-actions"><a href={`tel:${firm.phone.replace(/[^\d+]/g, "")}`}>전화 {firm.phone}</a><a href={firm.website} rel="noreferrer" target="_blank">홈페이지 ↗</a></div>
          </article>
        ))}</div>
      </section>

      <footer className="legal-footer"><NativeLink href="/">← 아파요 지도로 돌아가기</NativeLink><p>로펌 등록은 추천이나 승소 가능성 보증이 아니며, 상담·수임 여부는 이용자가 직접 결정합니다.</p></footer>
    </main>
  );
}
