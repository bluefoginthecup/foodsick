"use client";
import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "../firebase/client";
import type { AnalyticsReport } from "./analytics-model";
import type { ReportDraft } from "../contracts";
import type { PublicSignal } from "../public-signals";
import type { AdminReport } from "../firebase/report-api";
import { ReportDetails } from "./report-details";
import { regionMatches } from "../administrative-search";
import type { RegionSelection } from "../regional-contacts";

type VenueResult={checks?:{category:string;reports:number;eligible:number;owners:number;maxWindowOwners:number;region:string|null}[];signals:PublicSignal[];reason:string;reports:(AdminReport & {publicMenus:string[]|null;menuReview:{menus:string[]}|null})[];fixture:{expected:string;lat:number;lng:number}|null};
function region(d:ReportDraft){const p=d.district.trim().split(/\s+/); const gu=/[구군]$/.test(p[0]);return {sido:d.province,city:d.city,district:gu?p[0]:d.city,dong:gu?p.slice(1).join(" "):d.district};}
export function MapVenues({reports,selection,start,end,category,scope}:{reports:AnalyticsReport[];selection:RegionSelection;start:string;end:string;category:string;scope:string}){
  const [selected,setSelected]=useState("");const [result,setResult]=useState<VenueResult|null>(null);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const filtered=reports.filter(r=>{const d=r.draft as ReportDraft|null;return d && d.mealDate>=start && d.mealDate<=end && (category==="전체"||d.foodCategory===category) && regionMatches(region(d),selection);});
  const groups=new Map<string,AnalyticsReport[]>();for(const r of filtered){const id=(r.draft as ReportDraft).restaurantInternalId;groups.set(id,[...(groups.get(id)??[]),r]);}
  async function load(id:string){setBusy(true);setSelected(id);setResult(null);setMessage("");try{const client=getFirebaseClient()!;setResult((await httpsCallable<Record<string,unknown>,VenueResult>(client.functions,"getAdminVenueSignals")({restaurantId:id,scope})).data);}catch(e){setMessage(e instanceof Error?e.message:"조회 실패");}finally{setBusy(false);}}
  const detail=result?.reports.filter(r=>r.draft && r.draft.mealDate>=start && r.draft.mealDate<=end && (category==="전체"||r.draft.foodCategory===category))??[];
  const menus=new Map<string,number>();for(const r of detail){const menu=r.draft?.menu||"미입력";menus.set(menu,(menus.get(menu)??0)+1);}
  return <section className="signal-card" style={{border:"2px solid #8050b5"}}><h3>관리자 음식점·메뉴·신고 상세</h3><p>현재 지도 조건의 원본 신고 {filtered.length}건 · 독립 신고자 {new Set(filtered.map(r=>r.ownerUid)).size}명 · 동행 증상자 {filtered.reduce((n,r)=>n+(r.draft as ReportDraft).partySymptomatic,0)}명 · 병원 방문 {filtered.filter(r=>(r.draft as ReportDraft).medicalVisit).length}건</p>
  <p>음식점을 선택하면 공개 판단 이유와 개별 신고를 확인합니다. 원본 합계와 공개 신호는 중복 제거·수치 숨김 때문에 다를 수 있습니다.</p>
  {[...groups].map(([id,rows])=>{const d=rows[0].draft as ReportDraft;return <button type="button" className="secondary-button" disabled={busy} key={id} onClick={()=>void load(id)}>{d.restaurantDisplayInput} · {d.province} {d.city} {d.district} · 신고 {rows.length}건 / {new Set(rows.map(r=>r.ownerUid)).size}명 · 메뉴 {[...new Set(rows.map(r=>(r.draft as ReportDraft).menu))].join(", ")}</button>;})}
  {!groups.size&&<p>현재 조건에 해당하는 음식점이 없습니다.</p>}<p role="status">{busy?"음식점 집계 확인 중…":message}</p>
  {result&&groups.has(selected)&&<div><h4>{(groups.get(selected)![0].draft as ReportDraft).restaurantDisplayInput}</h4><p>최근 1년 전체 업소 판단: {result.reason} · 공개 신호 {result.signals.length}개</p>
  {result.checks?.map(c=><p key={c.category}>{c.category}: 접수 {c.reports}건 → 증상·상태 적격 {c.eligible}건 → 독립 신고자 {c.owners}명 → 72시간 내 최대 {c.maxWindowOwners}명 → 장소·업소 수 기준 {c.region??"미충족"}</p>)}
  <ul>{[...menus].map(([menu,count])=><li key={menu}>{menu}: 신고 {count}건</li>)}</ul>
  {result.fixture&&<p>가상 위치 {result.fixture.lat}, {result.fixture.lng} · 시험의 장소 조건상 예상 공개 단계: {result.fixture.expected} (독립 신고자·시간 조건은 추가 적용)</p>}
  {result.signals.map(s=><p key={s.id}>{s.region} · {s.category} · {s.observedAt} · 독립 신고 {s.independentReports}명 · 동행 {s.companionSymptoms??"비공개"} · 병원 {s.medicalVisits??"비공개"}</p>)}
  <p>아래 원본은 현재 기간·음식 유형 조건에 해당하는 {detail.length}건입니다. 동행자와 방문 수는 신고별 합계이며 동일 인물의 중복이 있을 수 있습니다.</p>
  {detail.map(r=><details key={r.id}><summary>{r.draft?.mealDate} {r.draft?.mealTime} · {r.draft?.menu||"메뉴 미입력"} · {r.status}</summary><ReportDetails report={r}/></details>)}
  </div>}</section>;
}
