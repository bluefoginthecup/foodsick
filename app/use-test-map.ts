"use client";
import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "./firebase/client";
import { useAuth } from "./auth/auth-context";
import type { AnalyticsReport } from "./admin/analytics-model";
export function useTestMap() {
  const {user,firebaseMode}=useAuth();
  const allowed=firebaseMode&&user?.role==="admin";
  const [revision,refresh]=useState(0);
  const [result,setResult]=useState<{key:string;reports:AnalyticsReport[];error:string}|null>(null);
  const key=`${user?.uid}:${revision}`;
  useEffect(()=>{
    if(!allowed||!revision)return;
    let cancelled=false;
    void(async()=>{try{
      const client=getFirebaseClient();if(!client)throw new Error("서버 연결을 확인해주세요.");
      const get=httpsCallable<Record<string,unknown>,{reports:AnalyticsReport[];nextCursor:string|null}>(client.functions,"getAdminAnalyticsPage");
      const reports:AnalyticsReport[]=[];let cursor:string|null=null;let bytes=0;
      do{const page:{reports:AnalyticsReport[];nextCursor:string|null}=(await get({source:"symptom",...(cursor?{cursor}:{})})).data;
        if(cancelled)return;reports.push(...page.reports);bytes+=new TextEncoder().encode(JSON.stringify(page.reports)).length;
        if(reports.length>10000||bytes>40000000)throw new Error("조회 한도를 초과했습니다.");
        if(page.nextCursor&&page.nextCursor===cursor)throw new Error("조회 위치 오류");cursor=page.nextCursor;
      }while(cursor);
      if(!cancelled)setResult({key,reports,error:""});
    }catch(e){if(!cancelled)setResult({key,reports:[],error:e instanceof Error?e.message:"조회 실패"});}})();
    return()=>{cancelled=true;};
  },[allowed,revision,key]);
  const current=allowed&&result?.key===key?result:null;
  return {allowed,refresh:()=>refresh(v=>v+1),loading:allowed&&revision>0&&!current,error:current?.error??"",loaded:!!current&&!current.error,reports:current?.reports??[]};
}
