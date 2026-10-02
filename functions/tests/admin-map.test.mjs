import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
const docs=new Map();let auto=0;
const snap=path=>({id:path.split('/').at(-1),ref:ref(path),exists:docs.has(path),data:()=>docs.get(path),get:k=>docs.get(path)?.[k]});
const ref=path=>({path,get:async()=>snap(path)});
function collection(name,filters=[],limit=Infinity){return {doc:(id=String(++auto))=>ref(`${name}/${id}`),where:(k,op,v)=>collection(name,[...filters,[k,op,v]],limit),orderBy(){return this;},limit:n=>collection(name,filters,n),get:async()=>{const result=[...docs].filter(([p,d])=>p.startsWith(`${name}/`)&&filters.every(([k,op,v])=>op==='=='?d[k]===v:d[k].toMillis()>=v.toMillis())).slice(0,limit).map(([p])=>snap(p));return {docs:result,size:result.length};}};}
const db={collection,getAll:async(...refs)=>refs.map(r=>snap(r.path)),runTransaction:async fn=>fn({get:r=>r.get(),update:(r,d)=>docs.set(r.path,{...docs.get(r.path),...d}),create:(r,d)=>docs.set(r.path,d)})};
mock.module('../lib/firebase.js',{namedExports:{db}});
mock.module('../lib/signal-publisher.js',{namedExports:{rebuildRestaurantSignals:async()=>{}}});
const {getAdminVenueSignals,reviewPublicMenus}=await import('../lib/admin-map.js');
const id='11111111-1111-4111-8111-111111111111';const venue=`manual_test_${id}_v2_0`;
const auth={uid:'admin',token:{role:'admin'}};
function seed(){docs.clear();docs.set('users/admin',{});docs.set(`testBatches/${id}`,{status:'active',scenarioVersion:2});for(let i=0;i<3;i++){docs.set(`users/t${i}`,{isTest:true,testBatchId:id});docs.set(`reports/r${i}`,{ownerUid:`t${i}`,restaurantId:venue,foodCategory:'냉면',status:'submitted',symptoms:['설사'],mealAt:Timestamp.fromMillis(Date.now()-86400000),symptomOnsetAt:Timestamp.fromMillis(Date.now()-80000000),medical:{visited:true},partySymptomatic:1,menu:'물냉면',updatedAt:Timestamp.fromMillis(1000)});}}
test('admin endpoints reject ordinary and anonymous callers',async()=>{for(const callable of [getAdminVenueSignals,reviewPublicMenus]){await assert.rejects(callable.run({data:{}}),e=>e.code==='permission-denied');await assert.rejects(callable.run({auth:{uid:'person',token:{}},data:{}}),e=>e.code==='permission-denied');}});
test('admin venue details include all member types and omit withdrawing users',async()=>{
 seed();const run=()=>getAdminVenueSignals.run({auth,data:{restaurantId:venue}});
 assert.equal((await run()).reports.length,3);
 docs.set('users/t2',{provider:'kakao'});assert.equal((await run()).reports.length,3);
 docs.set('users/t2',{status:'deleting'});assert.equal((await run()).reports.length,2);
});
test('menu moderation uses only catalog names and guards stale edits',async()=>{seed();const run=data=>reviewPublicMenus.run({auth,data:{reportId:'r0',expectedUpdatedAt:new Date(1000).toISOString(),...data}});await assert.rejects(run({menus:['private venue']}),e=>e.code==='invalid-argument');await assert.rejects(run({menus:['냉면'],expectedUpdatedAt:'stale'}),e=>e.code==='aborted');await run({menus:[]});assert.deepEqual(docs.get('reports/r0').menuReview.menus,[]);});
