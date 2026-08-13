"use client";

import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { useReports } from "../reports/report-store";

const demoReports = [
  { id: "demo-1", restaurant: "교동면옥 용인영덕점", region: "용인시 기흥구 영덕동", category: "냉면", symptoms: "설사, 복통", status: "submitted" },
  { id: "demo-2", restaurant: "교동면옥 영덕점", region: "용인시 기흥구 영덕동", category: "냉면", symptoms: "구토, 복통", status: "duplicate_suspected" },
  { id: "demo-3", restaurant: "영통 한상", region: "수원시 영통구", category: "한식", symptoms: "설사, 발열", status: "reviewed" },
] as const;

export default function AdminPage() {
  const { user } = useAuth();
  const { reports, auditEvents, setReportStatus } = useReports();
  const [activeTab, setActiveTab] = useState<"reports" | "clusters" | "audit">("reports");

  if (!user || user.role !== "admin") {
    return (
      <main className="admin-gate">
        <span aria-hidden="true">403</span>
        <h1>관리자 권한이 필요합니다</h1>
        <p>화면의 버튼이 아니라 서버의 Firebase custom claim으로 권한을 확인해야 합니다.</p>
        <NativeLink className="primary-button" href="/login">체험 로그인으로 이동</NativeLink>
        <NativeLink className="text-link" href="/">공개 지도로 돌아가기</NativeLink>
      </main>
    );
  }

  const totalReports = reports.length || demoReports.length;
  const visibleReports = reports.length ? reports.map((report) => ({
    id: report.id,
    restaurant: report.draft.restaurantDisplayInput,
    region: `${report.draft.city} ${report.draft.district}`,
    category: report.draft.foodCategory,
    symptoms: report.draft.symptoms.join(", "),
    status: report.status,
  })) : demoReports;

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div><span className="admin-mark">A</span><strong>아파요 지도 운영</strong></div>
        <NativeLink href="/">공개 지도</NativeLink>
      </header>
      <section className="admin-heading">
        <p className="eyebrow">관리자 전용 · 체험 데이터</p>
        <h1>신호 검토실</h1>
        <p>원본 음식점 정보는 이 관리자 영역에서만 확인합니다.</p>
      </section>
      <section className="admin-stats" aria-label="운영 통계">
        <div><span>최근 신고</span><strong>{totalReports}</strong><small>건</small></div>
        <div><span>중복 의심</span><strong>1</strong><small>건</small></div>
        <div><span>클러스터 후보</span><strong>1</strong><small>개</small></div>
        <div><span>공개 신호</span><strong>3</strong><small>개</small></div>
      </section>
      <nav className="admin-tabs" aria-label="관리자 메뉴">
        <button className={activeTab === "reports" ? "active" : ""} onClick={() => setActiveTab("reports")} type="button">신고</button>
        <button className={activeTab === "clusters" ? "active" : ""} onClick={() => setActiveTab("clusters")} type="button">클러스터</button>
        <button className={activeTab === "audit" ? "active" : ""} onClick={() => setActiveTab("audit")} type="button">감사기록</button>
      </nav>

      {activeTab === "reports" && (
        <section className="admin-list" aria-label="최근 신고 목록">
          {visibleReports.map((report) => (
            <article className="admin-report-card" key={report.id}>
              <div className="admin-report-main">
                <span className={`report-status ${report.status}`}>{report.status}</span>
                <h2>{report.restaurant}</h2>
                <p>{report.region} · {report.category}</p>
                <small>{report.symptoms}</small>
              </div>
              {reports.some((item) => item.id === report.id) ? (
                <div className="admin-actions">
                  <button onClick={() => setReportStatus(user.uid, report.id, "reviewed", "관리자 체험 검토")} type="button">검토 완료</button>
                  <button className="reject" onClick={() => setReportStatus(user.uid, report.id, "rejected", "관리자 체험 제외")} type="button">집계 제외</button>
                </div>
              ) : <span className="demo-only">예시 신고</span>}
            </article>
          ))}
        </section>
      )}

      {activeTab === "clusters" && (
        <section className="cluster-review-card">
          <div className="cluster-review-head"><span>increased_signal</span><strong>서로 다른 UID 3명</strong></div>
          <h2>교동면옥 용인영덕점</h2>
          <p>내부 매칭 · 최근 72시간 · 냉면 · 유사 위장관 증상</p>
          <dl>
            <div><dt>독립 신고</dt><dd>4건</dd></div>
            <div><dt>동행 증상자</dt><dd>7명</dd></div>
            <div><dt>병원 방문</dt><dd>2건</dd></div>
          </dl>
          <div className="privacy-check"><strong>공개 전 개인정보 관문</strong><span>동일 업종 업소 수 기준 충족 · 동 단위 공개 가능</span></div>
          <p className="official-warning">공식 근거가 없으므로 official_confirmed 상태로 변경할 수 없습니다.</p>
        </section>
      )}

      {activeTab === "audit" && (
        <section className="audit-list">
          {auditEvents.length === 0 ? <p>아직 관리자 변경 기록이 없습니다.</p> : auditEvents.map((event) => (
            <article key={event.id}><strong>{event.before} → {event.after}</strong><span>{event.note}</span><time>{new Date(event.createdAt).toLocaleString("ko-KR")}</time></article>
          ))}
        </section>
      )}
    </main>
  );
}
