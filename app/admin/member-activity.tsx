"use client";
import { useEffect, useState } from "react";
import { getFirebaseMemberActivities, type MemberActivity } from "../firebase/report-api";
const labels: Record<string, string> = { joined: "가입", login: "로그인", profile_updated: "계정 정보 수정", report_created: "신고 작성", report_updated: "신고 수정", report_deleted: "신고 삭제", report_reviewed: "관리자 검토 완료", report_rejected: "관리자 집계 제외", report_duplicate_suspected: "중복 의심 처리", report_included_in_cluster: "집계 포함 처리" };
export function MemberActivityPanel({ uid }: { uid: string }) {
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
  return <section className="member-activity"><h2>회원별 활동 기록</h2><p>기능 적용 이후의 이력만 기록합니다. 건강정보 원문은 활동 기록에 저장하지 않습니다.</p>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">활동 기록을 불러오는 중입니다.</p>}
    <button className="secondary-button" type="button" disabled={loading} onClick={() => { setLoading(true); setError(""); setRetry(n => n + 1); }}>새로고침</button>
    {!loading && !error && !items.length && <p>기록된 활동이 없습니다.</p>}
    {items.map(item => <article key={item.id}><strong>{labels[item.action] ?? item.action}</strong><time>{new Date(item.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>{item.reportId && <p>신고 번호: {item.reportId}</p>}{item.actorUid && <p>처리 관리자: {item.actorUid}</p>}</article>)}
    {cursor && <button className="secondary-button" disabled={loading} type="button" onClick={() => {
      setLoading(true); setError(""); void getFirebaseMemberActivities(uid, cursor).then(result => { setItems(previous => [...previous, ...result.activities.filter(item => !previous.some(old => old.id === item.id))]); setCursor(result.nextCursor); }).catch(() => setError("이전 활동을 불러오지 못했습니다.")).finally(() => setLoading(false));
    }}>이전 활동 더 보기</button>}
  </section>;
}
