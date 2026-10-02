"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { NativeLink } from "../native-link";
import { getMyAccount, updateMyAccount, type MyAccount } from "../firebase/account-api";

export default function AccountPage() {
  const { user, loading, firebaseMode, logout } = useAuth();
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const currentUid = useRef(user?.uid);
  useEffect(() => { currentUid.current = user?.uid; }, [user?.uid]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = firebaseMode ? await getMyAccount() : { uid: user.uid, nickname: sessionStorage.getItem(`nadoapa.nickname.${user.uid}`) ?? "", provider: "kakao", createdAt: null, lastLoginAt: null };
        if (!cancelled) { setAccount(result); setNickname(result.nickname); setError(""); }
      } catch { if (!cancelled) setError("계정 정보를 불러오지 못했습니다. 다시 시도해주세요."); }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, firebaseMode, retry]);
  const save = async () => {
    if (!user || !account || busy) return;
    const uid = user.uid;
    setBusy(true); setError(""); setNotice("");
    try {
      const value = nickname.trim();
      if (value.length > 30 || Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error("invalid-nickname");
      if (firebaseMode) await updateMyAccount(value);
      else sessionStorage.setItem(`nadoapa.nickname.${uid}`, value);
      if (currentUid.current !== uid) return;
      setAccount({ ...account, nickname: value }); setNickname(value); setNotice("계정 정보를 저장했어요.");
    } catch { if (currentUid.current === uid) setError("저장하지 못했습니다. 별명은 줄바꿈 없이 30자 이내로 입력하고 다시 시도해주세요."); }
    finally { setBusy(false); }
  };
  const date = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "기록 없음";
  if (loading) return <main className="narrow-page"><p role="status">로그인 확인 중…</p></main>;
  if (!user) return <main className="narrow-page"><section className="empty-reports"><h1>내 계정</h1><p>계정 정보를 확인하려면 로그인해주세요.</p><NativeLink className="kakao-button" href="/login?returnTo=%2Faccount">카카오로 시작하기</NativeLink></section></main>;
  const ready = account?.uid === user.uid;
  return <main className="narrow-page account-page">
    <NativeLink className="back-link" href="/">← 지도로 돌아가기</NativeLink>
    <h1>내 계정</h1><p>내 정보를 확인하고 별명을 수정할 수 있어요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!ready ? <section className="account-card">{error ? <button className="secondary-button" type="button" onClick={() => { setError(""); setRetry((n) => n + 1); }}>다시 불러오기</button> : <p role="status">계정 정보를 불러오는 중입니다.</p>}</section> : <>
      <form className="account-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <h2>{account.nickname ? `${account.nickname}님의 계정` : "내 정보"}</h2>
        <label htmlFor="account-nickname">별명 <small>선택</small></label>
        <input id="account-nickname" maxLength={30} autoComplete="nickname" value={nickname} disabled={busy} onChange={(event) => { setNickname(event.target.value); setNotice(""); }} aria-describedby="nickname-help" placeholder="사용할 별명을 입력하세요" />
        <p id="nickname-help">30자 이내로 입력해주세요. 비워서 저장하면 별명을 삭제합니다. 카카오 프로필 이름은 바뀌지 않습니다.</p>
        <button className="primary-button" disabled={busy || nickname === account.nickname} type="submit">{busy ? "저장 중…" : "변경사항 저장"}</button>
        {notice && <p className="matched-note" role="status">{notice}</p>}
      </form>
      <section className="account-card"><h2>계정 정보</h2><dl>
        <div><dt>로그인 방식</dt><dd>{firebaseMode ? "카카오 로그인" : "체험 로그인"}</dd></div>
        <div><dt>가입일 (한국 시간)</dt><dd>{date(account.createdAt)}</dd></div>
        <div><dt>최근 로그인 (한국 시간)</dt><dd>{date(account.lastLoginAt)}</dd></div>
      </dl><details><summary>내 회원 식별값 확인</summary><p className="account-uid">{account.uid}</p></details>
      <p>카카오 이름·이메일·전화번호는 수집하지 않습니다. 비밀번호는 카카오에서 관리합니다.</p></section>
    </>}
    <section className="account-card account-links"><h2>내 활동</h2><NativeLink className="secondary-button" href="/my-reports">내 신고 확인·수정</NativeLink><NativeLink className="secondary-button" href="/report">새 신고 작성</NativeLink><button className="text-link" disabled={busy} type="button" onClick={() => { setBusy(true); void logout().catch(() => { setError("로그아웃하지 못했습니다. 다시 시도해주세요."); }).finally(() => setBusy(false)); }}>로그아웃</button></section>
  </main>;
}
