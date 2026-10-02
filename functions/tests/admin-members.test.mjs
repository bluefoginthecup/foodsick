import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
const timestamp = Timestamp.fromMillis(1000);
const tables = {
  users: Array.from({length:32}, (_, index) => ({ id: `user_${String(index).padStart(2,'0')}`, data: { provider:'kakao', nickname:`별명${index}`, role:'user', createdAt:timestamp, lastLoginAt:timestamp, privateToken:'hidden' } })),
  reports: [{ id:'report_a', data:{ ownerUid:'user_00' } }],
  memberActivities: [{ id:'event_a', data:{ ownerUid:'user_00', action:'report_created', reportId:'report_a', createdAt:timestamp, healthText:'hidden' } }, { id:'event_b', data:{ ownerUid:'user_01', action:'login', createdAt:timestamp } }],
};
const snap = item => ({ id:item?.id, exists:!!item, data:()=>item?.data, get:key=>item?.data[key] });
function query(name, filter=()=>true, max=Infinity) {
 const results=()=>tables[name].filter(filter).slice(0,max);
 return { doc:id=>({get:async()=>name==='users'&&id==='admin'?snap({id,data:{role:'admin'}}):snap(tables[name].find(item=>item.id===id))}),
 orderBy:()=>query(name,filter,max), where:(field,op,value)=>query(name,item=>filter(item)&&item.data[field]===value,max),
 startAt:value=>query(name,item=>filter(item)&&item.id>=value,max), endAt:value=>query(name,item=>filter(item)&&item.id<=value,max),
 startAfter:value=>query(name,item=>filter(item)&&item.id>(typeof value==='string'?value:value.id),max),
 limit:n=>query(name,filter,n), get:async()=>({docs:results().map(snap)}), count:()=>({get:async()=>({data:()=>({count:results().length})})}) };
}
mock.module('../lib/firebase.js',{namedExports:{db:{collection:query}}});
const { getAdminMembers, getMemberActivities } = await import('../lib/admin-members.js');
const auth={uid:'admin',token:{role:'admin'}};
test('member directory restricts access, supports paging and omits private fields',async()=>{
 await assert.rejects(getAdminMembers.run({auth:{uid:'ordinary',token:{}},data:{}}),e=>e.code==='permission-denied');
 const page=await getAdminMembers.run({auth,data:{}});
 assert.equal(page.members.length,30); assert.equal(page.members[0].reportCount,1); assert.equal(page.members[0].privateToken,undefined);
 const next=await getAdminMembers.run({auth,data:{cursor:page.nextCursor}}); assert.equal(next.members.length,2);
 const found=await getAdminMembers.run({auth,data:{search:'user_01'}});assert.equal(found.members.length,1);
});
test('activity records are member-scoped and do not repeat health information',async()=>{
 await assert.rejects(getMemberActivities.run({data:{uid:'user_00'}}),e=>e.code==='permission-denied');
 const result=await getMemberActivities.run({auth,data:{uid:'user_00'}});
 assert.equal(result.activities.length,1);assert.equal(result.activities[0].action,'report_created');assert.equal(result.activities[0].healthText,undefined);
 await assert.rejects(getMemberActivities.run({auth,data:{uid:'user_00',cursor:'event_b'}}),e=>e.code==='invalid-argument');
});
