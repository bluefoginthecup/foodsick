import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
const docs = new Map(); const audits=[];
const snapshot = (name,id) => ({ id, exists:docs.has(`${name}/${id}`), data:()=>docs.get(`${name}/${id}`), get:key=>docs.get(`${name}/${id}`)?.[key] });
const ref = (name,id) => ({ name,id,get:async()=>snapshot(name,id) });
function collection(name,cursor='',limit=1000) {
  return {doc:id=>ref(name,id),orderBy(){return this;},startAfter:id=>collection(name,id,limit),limit:n=>collection(name,cursor,n),add:async d=>{audits.push(d);return {id:'audit1'};},get:async()=>({docs:[...docs.keys()].filter(k=>k.startsWith(`${name}/`) && k.split('/')[1]>cursor).sort().slice(0,limit).map(k=>snapshot(name,k.split('/')[1]))})};
}
mock.module('../lib/firebase.js',{namedExports:{db:{collection,getAll:async(...refs)=>refs.map(r=>snapshot(r.name,r.id))}}});
const {getAdminAnalyticsPage,recordAdminAnalyticsExport}=await import('../lib/admin-analytics.js');
const auth={uid:'admin',token:{role:'admin'}};
test('analytics rejects anonymous and ordinary users before reading report data',async()=>{
  await assert.rejects(getAdminAnalyticsPage.run({data:{source:'symptom'}}),e=>e.code==='permission-denied');
  await assert.rejects(getAdminAnalyticsPage.run({auth:{uid:'person',token:{}},data:{source:'cdc'}}),e=>e.code==='permission-denied');
});
test('pages all reports and classifies test accounts using trusted member records',async()=>{
  docs.clear();docs.set('users/admin',{});docs.set('users/real',{});docs.set('users/test',{isTest:true});
  for(let i=0;i<60;i++)docs.set(`reports/r${String(i).padStart(3,'0')}`,{ownerUid:i%3===0?'test':i%3===1?'real':'missing',draft:{menu:'private'},status:'submitted'});
  const first=await getAdminAnalyticsPage.run({auth,data:{source:'symptom'}});
  assert.equal(first.reports.length,50);assert.equal(first.nextCursor,'r049');
  assert.equal(first.reports[0].memberType,'test');assert.equal(first.reports[1].memberType,'real');assert.equal(first.reports[2].memberType,'unknown');
  const second=await getAdminAnalyticsPage.run({auth,data:{source:'symptom',cursor:first.nextCursor}});
  assert.equal(second.reports.length,10);assert.equal(second.nextCursor,null);
  await assert.rejects(getAdminAnalyticsPage.run({auth,data:{source:'users'}}),e=>e.code==='invalid-argument');
});
test('export audit records authenticated actor and bounded filters without accepting a forged actor',async()=>{
  const filters=Object.fromEntries(['source','memberType','dateBasis','start','end','region','restaurant','symptom','status','detailGroup','detailKey'].map(k=>[k,'']));
  await recordAdminAnalyticsExport.run({auth,data:{actorUid:'forged',filters,rowCount:60,loadedAt:'2026-10-02T00:00:00Z'}});
  assert.equal(audits.at(-1).actorUid,'admin');assert.equal(audits.at(-1).requestedRowCount,60);
  await assert.rejects(recordAdminAnalyticsExport.run({auth,data:{filters:{...filters,region:'x'.repeat(201)},rowCount:60,loadedAt:'2026-10-02T00:00:00Z'}}),e=>e.code==='invalid-argument');
});
