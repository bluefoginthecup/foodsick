"use client";
import { useI18n } from "../i18n/context";

import { useEffect, useState } from "react";
import { getFirebaseMemberActivities, type MemberActivity } from "../firebase/report-api";
const labels: Record<string, string> = { cdc_report_created: "CDC 신고 작성", cdc_report_updated: "CDC 신고 수정", cdc_report_deleted: "CDC 신고 삭제", cdc_report_reviewed: "CDC 신고 검토 완료", joined: "가입", login: "로그인", profile_updated: "계정 정보 수정", report_created: "신고 작성", report_updated: "신고 수정", report_deleted: "신고 삭제", report_reviewed: "관리자 검토 완료", report_rejected: "관리자 집계 제외", report_duplicate_suspected: "중복 의심 처리", report_included_in_cluster: "집계 포함 처리" };
export function MemberActivityPanel({ uid }: { uid: string }) {
  const { t, text, locale } = useI18n();
  const [items, setItems] = useState<MemberActivity[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void getFirebaseMemberActivities(uid).then((result) => { if (!cancelled) { setItems(result.activities); setCursor(result.nextCursor); } }).catch(() => { if (!cancelled) setError("활동 기록을 불러오지 못했습니다."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, retry]);
  return <section className="member-activity"><h2>{t("회원별 활동 기록")}</h2><p>{t("기능 적용 이후의 이력만 기록합니다. 건강정보 원문은 활동 기록에 저장하지 않습니다.")}</p>
    {text(error && <p role="alert">{text(error)}</p>)}{text(loading && <p role="status">{t("활동 기록을 불러오는 중입니다.")}</p>)}
    <button className="secondary-button" type="button" disabled={loading} onClick={() => { setLoading(true); setError(""); setRetry(n => n + 1); }}>{t("새로고침")}</button>
    {text(!loading && !error && !items.length && <p>{t("기록된 활동이 없습니다.")}</p>)}
    {text(items.map(item => <article key={item.id}><strong>{text(labels[item.action] ?? item.action)}</strong><time>{text(new Date(item.createdAt).toLocaleString(locale, { timeZone: "Asia/Seoul" }))}</time>{text(item.reportId && <p>{t("신고 번호: ")}{text(item.reportId)}</p>)}{text(item.actorUid && <p>{t("처리 관리자: ")}{text(item.actorUid)}</p>)}</article>))}
    {text(cursor && <button className="secondary-button" disabled={loading} type="button" onClick={() => {
      setLoading(true); setError(""); void getFirebaseMemberActivities(uid, cursor).then(result => { setItems(previous => [...previous, ...result.activities.filter(item => !previous.some(old => old.id === item.id))]); setCursor(result.nextCursor); }).catch(() => setError("이전 활동을 불러오지 못했습니다.")).finally(() => setLoading(false));
    }}>{t("이전 활동 더 보기")}</button>)}
  </section>;
}
