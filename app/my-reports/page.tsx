"use client";
import { useI18n } from "../i18n/context";

import { useState } from "react";

import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { useReports } from "../reports/report-store";
import { CdcReportList } from "../cdc-report/report-list";

const statusLabel = {
  submitted: "접수됨",
  duplicate_suspected: "중복 확인 중",
  reviewed: "검토됨",
  included_in_cluster: "신호 집계에 포함",
  rejected: "집계 제외",
};

export default function MyReportsPage() {
  const { t, text, locale } = useI18n();
  const { user, loading, firebaseMode } = useAuth();
  const { reports, deleteReport } = useReports();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mine = user ? reports.filter((report) => report.ownerUid === user.uid) : [];

  if (loading) {
    return (
      <main className="narrow-page">
        <section className="empty-reports" aria-live="polite"><h1>{t("로그인 확인 중…")}</h1></section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="narrow-page">
        <NativeLink className="back-link" href="/">{t("← 지도로 돌아가기")}</NativeLink>
        <section className="empty-reports">
          <h1>{t("내 신고를 보려면 먼저 로그인해주세요")}</h1>
          <NativeLink className="kakao-button" href="/login">{t("카카오로 시작하기")}</NativeLink>
        </section>
      </main>
    );
  }

  return (
    <main className="my-reports-page">
      <header className="report-header">
        <NativeLink className="back-link" href="/">{t("← 지도")}</NativeLink>
        <NativeLink className="small-action" href="/report">{t("새 신고")}</NativeLink>
      </header>
      <section className="my-reports-heading">
        <p className="eyebrow">{t("나만 볼 수 있어요")}</p>
        <h1>{t("내 신고")}</h1>
        <NativeLink className="text-link" href="/account">{t("내 계정·정보 수정 →")}</NativeLink>
        <p>{text(firebaseMode ? "카카오 계정으로 로그인한 본인 신고만 표시됩니다." : "체험 모드에서는 이 브라우저 탭을 닫거나 새로고침하면 신고가 사라집니다.")}</p>
      </section>

      {text(mine.length === 0 ? (
        <section className="empty-reports">
          <span aria-hidden="true">○</span>
          <h2>{t("아직 제출한 신고가 없어요")}</h2>
          <p>{t("외식 후 위장관 증상이 있었다면 알려주세요.")}</p>
          <NativeLink className="primary-button" href="/report">{t("첫 신고 작성하기")}</NativeLink>
        </section>
      ) : (
        <div className="report-list">
          {text(mine.map((report) => (
            <article className="my-report-card" key={report.id}>
              <div className="my-report-topline">
                <span className={`report-status ${report.status}`}>{text(statusLabel[report.status])}</span>
                <time>{text(new Date(report.createdAt).toLocaleString(locale, { timeZone: "Asia/Seoul" }))}</time>
              </div>
              <h2>{text(report.draft.foodCategory || "음식 유형 미선택")} · {text(report.draft.province)} {text(report.draft.city)}</h2>
              <p className="private-restaurant">{report.draft.restaurantDisplayInput}<span>{t("외부 비공개")}</span></p>
              <dl>
                <div><dt>{t("식사일")}</dt><dd>{text(report.draft.mealDate)} {text(report.draft.mealTime)}</dd></div>
                <div><dt>{t("증상")}</dt><dd>{text(report.draft.symptoms.join(", "))}</dd></div>
                <div><dt>{t("동행 증상자")}</dt><dd>{text(report.draft.partySymptomatic)}{t("명")}</dd></div>
              </dl>
              {text(report.status !== "rejected" && <NativeLink className="edit-report" href={`/report?edit=${report.id}`}>{t("신고 내용 수정")}</NativeLink>)}
              {text(report.status === "rejected" && <p>{t("집계 제외된 신고는 수정할 수 없습니다.")}</p>)}
              <button className="text-link danger-link" type="button" disabled={busy} onClick={() => setConfirmId(report.id)}>{t("신고 삭제")}</button>
              {text(confirmId === report.id && <div className="delete-confirm" role="group" aria-label={t("신고 삭제 확인")}><strong>{t("이 신고를 삭제할까요?")}</strong><p>{t("작성 내용과 동행자 정보가 삭제되며 복구할 수 없습니다. 공개 집계에서도 제외됩니다.")}</p><button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmId(null)}>{t("취소")}</button><button className="danger-button" type="button" disabled={busy} onClick={() => {
                setBusy(true); setMessage(""); void deleteReport(report.id).then(() => { setConfirmId(null); setMessage("신고를 삭제했어요. 공개 집계 반영에는 잠시 시간이 걸릴 수 있습니다."); }).catch(() => setMessage("신고를 삭제하지 못했습니다. 다시 시도해주세요.")).finally(() => setBusy(false));
              }}>{text(busy ? "삭제 중…" : "삭제 확정")}</button></div>)}
            </article>
          )))}
        </div>
      ))}
      {text(message && <p role="status">{text(message)}</p>)}
      <CdcReportList key={user.uid} />
    </main>
  );
}
