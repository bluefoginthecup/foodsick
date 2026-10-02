"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { getFirebaseAdminMembers, type AdminMember } from "../firebase/report-api";

export function MemberList({ onReports }: { onReports: (uid: string) => void }) {
  const { firebaseMode } = useAuth();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ search: "", version: 0 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!firebaseMode) return;
    let cancelled = false;
    void getFirebaseAdminMembers(query.search).then((result) => {
      if (!cancelled) { setMembers(result.members); setCursor(result.nextCursor); }
    }).catch(() => { if (!cancelled) setError("회원 목록을 불러오지 못했습니다. 다시 조회해주세요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [firebaseMode, query]);
  const more = async () => {
    if (!cursor || loading) return;
    setLoading(true); setError("");
    try {
      const result = await getFirebaseAdminMembers(query.search, cursor);
      setMembers((previous) => [...previous, ...result.members.filter((item) => !previous.some((existing) => existing.uid === item.uid))]); setCursor(result.nextCursor);
    } catch { setError("다음 회원 목록을 불러오지 못했습니다. 다시 시도해주세요."); }
    finally { setLoading(false); }
  };
  const date = (input: string) => input ? new Date(input).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "기록 없음";
  if (!firebaseMode) return <p>회원 목록은 실제 로그인 서비스에서 확인할 수 있습니다.</p>;
  return <section aria-label="회원 목록" className="admin-member-list">
    <p>이름·이메일을 수집하지 않아 회원 식별값으로 표시합니다. 식별값 순서로 조회합니다.</p>
    <form className="member-search" onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(""); setMembers([]); setCursor(null); setQuery({ search: search.trim(), version: query.version + 1 }); }}>
      <label>회원 식별값 검색<input value={search} maxLength={128} onChange={(event) => setSearch(event.target.value)} placeholder="전체 또는 앞부분 입력" /></label><button className="secondary-button" disabled={loading} type="submit">{loading ? "조회 중…" : "조회·새로고침"}</button>
    </form>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!loading && !error && !members.length && <p>조건에 맞는 회원이 없습니다.</p>}
    {members.map((member) => <article className="admin-member-card" key={member.uid}>
      <div><span>{member.role === "admin" ? "관리자" : "일반 회원"} · {member.provider} · {member.status === "deleting" ? "탈퇴 처리 중" : "이용 중"}</span><h2>{member.nickname || "별명 미설정"}</h2><p className="account-uid">{member.uid}</p></div>
      <dl className="admin-detail-grid"><div><dt>가입일 (한국 시간)</dt><dd>{date(member.createdAt)}</dd></div><div><dt>최근 로그인 (한국 시간)</dt><dd>{date(member.lastLoginAt)}</dd></div><div><dt>작성한 신고</dt><dd>{member.reportCount}건</dd></div></dl>
      <button className="secondary-button" type="button" onClick={() => onReports(member.uid)}>회원 상세 · 신고·활동 기록</button>
    </article>)}
    {cursor && <button type="button" className="secondary-button" disabled={loading} onClick={() => void more()}>회원 더 보기</button>}
  </section>;
}
