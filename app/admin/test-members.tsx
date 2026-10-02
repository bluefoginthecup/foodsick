"use client";
import { useI18n } from "../i18n/context";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteApp, initializeApp } from "firebase/app";
import { initializeAuth, inMemoryPersistence, signInWithCustomToken, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseClientConfig, getFirebaseClient } from "../firebase/client";
import { testScenario, realisticTestScenario } from "./test-scenarios";

type Batch = { scenarioVersion?: number; id: string; status: string; count: number; date: string };
type Member = { uid: string; nickname: string; status: string };
type Response = { batches?: Batch[]; members?: Member[]; status?: string; date?: string; customToken?: string };
async function manage(data: Record<string, unknown>) {
  const client = getFirebaseClient();
  if (!client) throw new Error("서버 연결을 확인해주세요.");
  return (await httpsCallable<Record<string, unknown>, Response>(client.functions, "manageTestMembers")(data)).data;
}
const errorMessage = (e: unknown) => e instanceof Error ? e.message : "처리하지 못했습니다. 다시 시도해주세요.";

export function TestMembersPanel() {
  const { t, text } = useI18n();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [count, setCount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const stop = useRef(false);
  const batch = batches.find(b => b.id === selected);
  const refresh = useCallback(async (id: string) => {
    const response = await manage({ action: "batches" });
    setBatches(response.batches ?? []);
    if (id) {
      const detail = await manage({ action: "list", batchId: id });
      setMembers(detail.members ?? []);
    }
  }, []);
  useEffect(() => { void refresh(selected).catch(e => setMessage(errorMessage(e))); }, [refresh, selected]);
  useEffect(() => () => { stop.current = true; }, []);
  async function create() {
    setBusy(true); setMessage("");
    const id = crypto.randomUUID();
    try { await manage({ action: "create", batchId: id, count }); setSelected(id); await refresh(id); setMessage(`${count}명의 테스트 회원을 생성했습니다.`); }
    catch (e) { setMessage(errorMessage(e)); await refresh(selected).catch(() => {}); }
    finally { setBusy(false); }
  }
  function login(member: Member) {
    const popup = window.open("/test-login", "_blank", "popup,width=480,height=850");
    if (!popup) { setMessage("테스트 창을 열려면 이 사이트의 팝업을 허용해주세요."); return; }
    let used = false;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup || event.data?.type !== "test-login-ready" || used) return;
      used = true;
      window.removeEventListener("message", receive);
      void manage({ action: "token", batchId: selected, uid: member.uid }).then(r => {
        popup.postMessage({ type: "test-login-token", token: r.customToken }, window.location.origin);
      }).catch(e => { popup.close(); setMessage(errorMessage(e)); });
    };
    window.addEventListener("message", receive);
    window.setTimeout(() => window.removeEventListener("message", receive), 60000);
  }
  async function run() {
    if (!batch) return;
    setBusy(true); setResults([]); setMessage("시험 중에는 이 화면을 열어두세요."); stop.current = false;
    const app = initializeApp(firebaseClientConfig()!, `test-run-${crypto.randomUUID()}`);
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const functions = getFunctions(app, "asia-northeast3");
    const submit = httpsCallable<Record<string, unknown>, { outcome: string; reportId: string }>(functions, "submitReport");
    let succeeded = 0; let failed = 0;
    try {
      for (const member of members.filter(m => m.status === "active")) {
        if (stop.current) break;
        try {
          const token = await manage({ action: "token", batchId: selected, uid: member.uid });
          await signInWithCustomToken(auth, token.customToken!);
          const index = Number(member.uid.slice(-3)) - 1;
          const report = { ...(batch.scenarioVersion === 2 ? realisticTestScenario : testScenario)(selected, batch.date, index), sensitiveDataConsentVersion: "consent-v1" };
          const outcome = (await submit(report)).data;
          let result = outcome.outcome === "duplicate" ? "기존 신고 확인" : "신고 완료";
          if (index >= 90) {
            const duplicate = (await submit(report)).data;
            if (duplicate.outcome !== "duplicate" || duplicate.reportId !== outcome.reportId) throw new Error("중복 방지 결과가 예상과 다릅니다.");
            await httpsCallable(functions, "updateReport")({ reportId: outcome.reportId, report: { ...report, menu: "수정한 가상 메뉴" } });
            await httpsCallable(functions, "deleteMyReport")({ reportId: outcome.reportId });
            result = "중복·수정·삭제 완료";
          }
          succeeded++;
          setResults(items => [...items, `${member.nickname}: ${result}`]);
        } catch (e) { failed++; setResults(items => [...items, `${member.nickname}: 실패 — ${errorMessage(e)}`]); }
        finally { await signOut(auth); }
      }
      if(batch.scenarioVersion===2 && batch.count===100 && succeeded===100 && !failed && !stop.current){
        setMessage("100명 실행 완료. 예상 집계와 비교하는 중입니다…");
        const ids=[...new Set(Array.from({length:90},(_,i)=>realisticTestScenario(selected,batch.date,i).restaurantInternalId))];
        const evaluate=httpsCallable<Record<string,unknown>,{signals:unknown[];candidates:unknown[];reports:unknown[]}>(getFirebaseClient()!.functions,"getAdminVenueSignals");
        let signals=0,candidates=0,reports=0;
        for(let i=0;i<ids.length;i+=3){const values=await Promise.all(ids.slice(i,i+3).map(restaurantId=>evaluate({restaurantId,scope:selected})));for(const {data} of values){signals+=data.signals.length;candidates+=data.candidates.length;reports+=data.reports.length;}}
        setResults(items=>[...items,`예상 비교: 남은 신고 ${reports}/90건 · 집계 후보 ${candidates}/14개 · 공개 신호 ${signals}/9개 — ${reports===90&&candidates===14&&signals===9?"통과":"불일치: 수정·삭제 또는 별도 신고 여부를 확인해주세요."}`]);
      }
      setMessage(`${stop.current ? "중지" : "완료"}: 성공 ${succeeded}명, 실패 ${failed}명. 다시 실행하면 기존 신고는 중복으로 확인합니다.`);
    } catch (e) { setMessage(errorMessage(e)); }
    finally { await deleteApp(app); setBusy(false); }
  }
  async function end() {
    setBusy(true);
    try { await manage({ action: "end", batchId: selected }); await refresh(selected); setConfirmEnd(false); setMessage("접속을 차단하고 파기를 시작했습니다. 새로고침으로 남은 회원 수를 확인해주세요. 집계 재계산은 별도로 진행됩니다."); }
    catch (e) { setMessage(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section className="test-members-panel">
    <h2>{t("테스트 회원 관리")}</h2>
    <p>{t("카카오 계정 없이 실제 신고 기능을 시험합니다. 테스트 창은 관리자 로그인을 유지한 채 열립니다.")}</p>
    <div className="test-controls"><label>{t("생성할 회원 수 ")}<input type="number" min={1} max={100} value={count} disabled={busy} onChange={e => setCount(Number(e.target.value))} /></label><button className="primary-button" disabled={busy || count < 1 || count > 100 || !Number.isInteger(count)} onClick={() => void create()} type="button">{t("테스트 회원 생성")}</button></div>
    <div className="test-controls"><label>{t("시험 선택 ")}<select disabled={busy} value={selected} onChange={e => { setSelected(e.target.value); setResults([]); setConfirmEnd(false); }}><option value="">{t("시험을 선택해주세요")}</option>{text(batches.map(b => <option key={b.id} value={b.id}>{text(b.date)} · {text(b.count)}{t("명 · ")}{text(b.status === "active" ? "진행 중" : "종료")} · {text(b.id.slice(0, 8))}</option>))}</select></label><button disabled={busy} onClick={() => void refresh(selected).catch(e => setMessage(errorMessage(e)))} type="button">{t("새로고침")}</button></div>
    {text(batch && <>
      <p>{t("남은 회원 ")}{text(members.length)}{t("명 · 파기 대기 ")}{text(members.filter(m => m.status === "deleting").length)}{t("명")}</p>
      <p>{t("자동 신고는 가상 음식점을 사용합니다. 새 시험은 여러 지역과 최근 30일에 분산합니다. 1~30번은 3명씩, 31~50번은 2명씩, 51~70번은 5명씩 같은 업소를 신고하며 71~90번은 개별 신고, 91~100번은 중복·수정·삭제를 시험합니다. 일반 회원과 합쳐 공개 지도에 표시됩니다. 시험 종료 후 회원·신고를 파기하면 재집계됩니다. 기존 시험은 기존 시나리오를 유지합니다.")}</p>
      <div className="test-controls"><button className="primary-button" disabled={busy || batch.status !== "active"} onClick={() => void run()} type="button">{t("회원별 자동 신고 실행")}</button>{text(busy && <button onClick={() => { stop.current = true; }} type="button">{t("자동 신고 중지")}</button>)}<button disabled={busy || !members.length} onClick={() => setConfirmEnd(true)} type="button">{t("시험 종료·전체 파기")}</button></div>
      {text(confirmEnd && <div className="test-confirm"><p>{t("이 시험의 테스트 회원 ")}{text(members.length)}{t("명과 연결된 신고·동행자 정보를 파기합니다. 복구할 수 없습니다.")}</p><button disabled={busy} onClick={() => void end()} type="button">{t("종료하고 파기")}</button><button disabled={busy} onClick={() => setConfirmEnd(false)} type="button">{t("취소")}</button></div>)}
      <ul className="test-member-list">{text(members.map(m => <li key={m.uid}><span>{m.nickname} · {text(m.status === "deleting" ? "파기 중" : "사용 가능")}</span><button disabled={busy || batch.status !== "active" || m.status !== "active"} onClick={() => login(m)} type="button">{t("회원으로 접속")}</button></li>))}</ul>
    </>)}
    <p role="status">{text(message)}</p>
    {text(!!results.length && <details open><summary>{t("자동 신고 결과 ")}{text(results.length)}{t("명")}</summary><ul className="test-results">{text(results.map((r, i) => <li key={i}>{text(r)}</li>))}</ul></details>)}
    <small>{t("파기는 운영 데이터와 인증 계정을 대상으로 합니다. 백업·플랫폼 로그의 보존 기간은 별도 정책을 따릅니다.")}</small>
  </section>;
}
