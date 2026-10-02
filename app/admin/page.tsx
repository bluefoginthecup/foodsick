"use client";
import { useI18n } from "../i18n/context";


import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { useReports } from "../reports/report-store";
import { useContactFeedback } from "../contact-feedback/contact-feedback-store";
import { ReportReviewPanel } from "./report-review";
import { MemberList } from "./member-list";
import { MemberActivityPanel } from "./member-activity";
import { LawFirmReviewPanel } from "./law-firm-review";
import { AnalyticsPanel } from "./analytics-panel";
import { TestMembersPanel } from "./test-members";
import { CdcReportList } from "../cdc-report/report-list";
import { ResourceDirectory } from "../resources/resource-directory";

const feedbackReasonLabel = {
  wrong_phone: "전화 연결 안 됨",
  outdated: "이전·폐지 정보",
  wrong_office: "관할 기관·부서 오류",
  other: "그 밖의 문제",
} as const;

export default function AdminPage() {
  const { t, text, locale } = useI18n();
  const { user, loading, firebaseMode, logout } = useAuth();
  const { auditEvents } = useReports();
  const { feedback } = useContactFeedback();
  const [activeTab, setActiveTab] = useState<"reports" | "members" | "clusters" | "contacts" | "law_firms" | "audit" | "test" | "cdc" | "resources" | "analytics">("reports");
  const [reportOwner, setReportOwner] = useState<string | undefined>();

  if (loading) {
    return <main className="admin-gate" aria-live="polite"><span aria-hidden="true">…</span><h1>{t("권한 확인 중")}</h1></main>;
  }

  if (!user || user.role !== "admin") {
    return (
      <main className="admin-gate">
        <span aria-hidden="true">403</span>
        <h1>{t("관리자 권한이 필요합니다")}</h1>
        <p>{t("화면의 버튼이 아니라 서버의 Firebase custom claim으로 권한을 확인해야 합니다.")}</p>
        {text(user && firebaseMode ? <div className="admin-access-guide">
          <strong>{t("현재 카카오 계정 UID")}</strong>
          <code>{user.uid}</code>
          <ol><li>{t("Firebase Firestore의 ")}<b>{t("users / 현재 UID")}</b>{t(" 문서를 엽니다.")}</li><li><b>role</b>{t(" 필드를 문자열 ")}<b>admin</b>{t("으로 변경합니다.")}</li><li>{t("아래에서 로그아웃한 뒤 카카오로 다시 로그인합니다.")}</li></ol>
          <a href={`https://console.firebase.google.com/project/foodsick-signal-map-kr/firestore/databases/-default-/data/~2Fusers~2F${user.uid}`} rel="noreferrer" target="_blank">{t("Firebase에서 내 권한 문서 열기 ↗")}</a>
          <button className="primary-button" onClick={() => void logout().then(() => window.location.assign("/login"))} type="button">{t("권한 반영을 위해 로그아웃")}</button>
        </div> : <NativeLink className="primary-button" href="/login">{text(firebaseMode ? "카카오 로그인으로 이동" : "체험 로그인으로 이동")}</NativeLink>)}
        <NativeLink className="text-link" href="/">{t("공개 지도로 돌아가기")}</NativeLink>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div><span className="admin-mark">A</span><strong>{t("나두아파 운영")}</strong></div>
        <NativeLink href="/">{t("공개 지도")}</NativeLink>
      </header>
      <section className="admin-heading">
        <p className="eyebrow">{t("관리자 전용")}</p>
        <h1>{t("신호 검토실")}</h1>
        <p>{t("원본 음식점 정보는 이 관리자 영역에서만 확인합니다.")}</p>
      </section>
      <nav className="admin-tabs" aria-label={t("관리자 메뉴")}>
        <button className={activeTab === "analytics" ? "active" : ""} onClick={() => setActiveTab("analytics")} type="button">{t("신고 통계·엑셀")}</button>
        <button className={activeTab === "resources" ? "active" : ""} onClick={() => setActiveTab("resources")} type="button">{t("자료실 승인·관리")}</button>
        {text(firebaseMode && <button className={activeTab === "test" ? "active" : ""} onClick={() => setActiveTab("test")} type="button">{t("테스트 회원")}</button>)}
        <button className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")} type="button">{t("회원 목록")}</button>
        <button className={activeTab === "reports" ? "active" : ""} onClick={() => setActiveTab("reports")} type="button">{t("신고")}</button>
        <button className={activeTab === "cdc" ? "active" : ""} onClick={() => setActiveTab("cdc")} type="button">{t("CDC 신고")}</button>
        <button className={activeTab === "clusters" ? "active" : ""} onClick={() => setActiveTab("clusters")} type="button">{t("클러스터")}</button>
        <button className={activeTab === "contacts" ? "active" : ""} onClick={() => setActiveTab("contacts")} type="button">{t("연락처 오류 ")}{text(feedback.length ? `(${feedback.length})` : "")}</button>
        <button className={activeTab === "law_firms" ? "active" : ""} onClick={() => setActiveTab("law_firms")} type="button">{t("로펌 등록")}</button>
        <button className={activeTab === "audit" ? "active" : ""} onClick={() => setActiveTab("audit")} type="button">{t("감사기록")}</button>
      </nav>

      {text(activeTab === "members" && <MemberList onReports={(uid) => { setReportOwner(uid); setActiveTab("reports"); }} />)}
      {activeTab === "analytics" && <AnalyticsPanel />}
      {text(activeTab === "test" && firebaseMode && <TestMembersPanel />)}
      {text(activeTab === "cdc" && <CdcReportList admin />)}
      {text(activeTab === "resources" && <ResourceDirectory admin />)}
      {text(activeTab === "reports" && <>
        {text(reportOwner && <div className="member-report-filter"><span>{t("회원 ")}{text(reportOwner)}{t("의 신고")}</span><button type="button" onClick={() => setReportOwner(undefined)}>{t("전체 신고 보기")}</button></div>)}
        <ReportReviewPanel key={reportOwner ?? "all"} ownerUid={reportOwner} />
        {text(reportOwner && <CdcReportList key={`cdc-${reportOwner}`} admin ownerUid={reportOwner} />)}
        {text(reportOwner && firebaseMode && <MemberActivityPanel key={`activity-${reportOwner}`} uid={reportOwner} />)}
      </>)}

      {text(activeTab === "clusters" && firebaseMode && <p>{t("공개 집계 결과는 공개 지도에서 확인할 수 있습니다.")}</p>)}
      {text(activeTab === "clusters" && !firebaseMode && (
        <section className="cluster-review-card">
          <div className="cluster-review-head"><span>increased_signal</span><strong>{t("서로 다른 UID 3명")}</strong></div>
          <h2>{t("교동면옥 용인영덕점")}</h2>
          <p>{t("내부 매칭 · 최근 72시간 · 냉면 · 유사 위장관 증상")}</p>
          <dl>
            <div><dt>{t("독립 신고")}</dt><dd>{t("4건")}</dd></div>
            <div><dt>{t("동행 증상자")}</dt><dd>{t("7명")}</dd></div>
            <div><dt>{t("병원 방문")}</dt><dd>{t("2건")}</dd></div>
          </dl>
          <div className="privacy-check"><strong>{t("공개 전 개인정보 관문")}</strong><span>{t("동일 업종 업소 수 기준 충족 · 동 단위 공개 가능")}</span></div>
          <p className="official-warning">{t("공식 근거가 없으므로 official_confirmed 상태로 변경할 수 없습니다.")}</p>
        </section>
      ))}

      {text(activeTab === "contacts" && (
        <section className="contact-feedback-admin" aria-label={t("연락처 오류 신고 목록")}>
          {text(feedback.length === 0 ? <p>{t("접수된 연락처 오류 신고가 없습니다.")}</p> : feedback.map((item) => (
            <article key={item.id}>
              <div><span>{text(feedbackReasonLabel[item.reason])}</span><time>{text(new Date(item.createdAt).toLocaleString(locale))}</time></div>
              <h2>{item.contact.name}</h2>
              <p>{text(item.region)} · {text(item.contact.phone)}</p>
              {text(item.note && <blockquote>{item.note}</blockquote>)}
              <a href={item.contact.sourceUrl} rel="noreferrer" target="_blank">{t("공식 출처 확인 ↗")}</a>
            </article>
          )))}
        </section>
      ))}

      {text(activeTab === "law_firms" && <LawFirmReviewPanel />)}

      {text(activeTab === "audit" && (
        <section className="audit-list">
          {text(auditEvents.length === 0 ? <p>{t("아직 관리자 변경 기록이 없습니다.")}</p> : auditEvents.map((event) => (
            <article key={event.id}><strong>{text(event.before)} → {text(event.after)}</strong><span>{event.note}</span><time>{text(new Date(event.createdAt).toLocaleString(locale))}</time></article>
          )))}
        </section>
      ))}
    </main>
  );
}
