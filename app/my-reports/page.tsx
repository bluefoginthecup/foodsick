"use client";

import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { useReports } from "../reports/report-store";

const statusLabel = {
  submitted: "접수됨",
  duplicate_suspected: "중복 확인 중",
  reviewed: "검토됨",
  included_in_cluster: "신호 집계에 포함",
  rejected: "집계 제외",
};

export default function MyReportsPage() {
  const { user, loading, firebaseMode } = useAuth();
  const { reports } = useReports();
  const mine = user ? reports.filter((report) => report.ownerUid === user.uid) : [];

  if (loading) {
    return (
      <main className="narrow-page">
        <section className="empty-reports" aria-live="polite"><h1>로그인 확인 중…</h1></section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="narrow-page">
        <NativeLink className="back-link" href="/">← 지도로 돌아가기</NativeLink>
        <section className="empty-reports">
          <h1>내 신고를 보려면<br />먼저 로그인해주세요</h1>
          <NativeLink className="kakao-button" href="/login">카카오로 시작하기</NativeLink>
        </section>
      </main>
    );
  }

  return (
    <main className="my-reports-page">
      <header className="report-header">
        <NativeLink className="back-link" href="/">← 지도</NativeLink>
        <NativeLink className="small-action" href="/report">새 신고</NativeLink>
      </header>
      <section className="my-reports-heading">
        <p className="eyebrow">나만 볼 수 있어요</p>
        <h1>내 신고</h1>
        <p>{firebaseMode ? "카카오 계정으로 로그인한 본인 신고만 표시됩니다." : "체험 모드에서는 이 브라우저 탭을 닫거나 새로고침하면 신고가 사라집니다."}</p>
      </section>

      {mine.length === 0 ? (
        <section className="empty-reports">
          <span aria-hidden="true">○</span>
          <h2>아직 제출한 신고가 없어요</h2>
          <p>외식 후 위장관 증상이 있었다면 알려주세요.</p>
          <NativeLink className="primary-button" href="/report">첫 신고 작성하기</NativeLink>
        </section>
      ) : (
        <div className="report-list">
          {mine.map((report) => (
            <article className="my-report-card" key={report.id}>
              <div className="my-report-topline">
                <span className={`report-status ${report.status}`}>{statusLabel[report.status]}</span>
                <time>{new Date(report.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>
              </div>
              <h2>{report.draft.foodCategory || "음식 유형 미선택"} · {report.draft.province} {report.draft.city}</h2>
              <p className="private-restaurant">{report.draft.restaurantDisplayInput}<span>외부 비공개</span></p>
              <dl>
                <div><dt>식사일</dt><dd>{report.draft.mealDate} {report.draft.mealTime}</dd></div>
                <div><dt>증상</dt><dd>{report.draft.symptoms.join(", ")}</dd></div>
                <div><dt>동행 증상자</dt><dd>{report.draft.partySymptomatic}명</dd></div>
              </dl>
              <NativeLink className="edit-report" href={`/report?edit=${report.id}`}>신고 내용 수정</NativeLink>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
