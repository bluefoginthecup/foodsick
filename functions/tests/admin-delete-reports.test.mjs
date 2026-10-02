import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
const docs = new Map(); let serial = 0;
const snapshot = path => ({ exists: docs.has(path), get: key => docs.get(path)?.[key], data: () => docs.get(path) });
const ref = path => ({ path, get: async () => snapshot(path) });
mock.module('../lib/firebase.js', { namedExports: { db: {
  collection: name => ({ doc: (id = `generated_${++serial}`) => ref(`${name}/${id}`) }),
  runTransaction: async fn => {
    const writes = [];
    const result = await fn({ get: async r => snapshot(r.path), delete: r => writes.push(() => docs.delete(r.path)), set: (r,d) => writes.push(() => docs.set(r.path,d)), create: (r,d) => writes.push(() => docs.set(r.path,d)) });
    writes.forEach(w => w()); return result;
  }
} } });
process.env.DEDUPE_HMAC_SECRET = 'isolated-admin-delete-test-secret';
const { deleteAdminReports } = await import('../lib/admin-delete-reports.js');
const { createDedupeKey } = await import('../lib/domain/keys.js');
const auth = { uid:'admin', token:{role:'admin'} };
const target = (source,id,revision=0) => ({source,id,revision,updatedAt:''});
const run = reports => deleteAdminReports.run({auth,data:{confirmation:'삭제',reports}});
test('bulk delete rejects ordinary accounts, missing confirmation, invalid IDs and unbounded requests', async () => {
  docs.clear(); docs.set('users/admin',{});
  for (const auth of [undefined,{uid:'member',token:{}}]) await assert.rejects(deleteAdminReports.run({auth,data:{reports:[target('symptom','a')]}}),e=>e.code==='permission-denied');
  await assert.rejects(deleteAdminReports.run({auth,data:{reports:[target('symptom','a')]}}),e=>e.code==='invalid-argument');
  for (const targets of [[],[target('users','a')],[target('symptom','../a')],Array.from({length:26},(_,i)=>target('cdc',String(i))),[target('cdc','a'),target('cdc','a')]]) await assert.rejects(run(targets),e=>e.code==='invalid-argument');
});
test('mixed-source delete removes only selected records, linked companions and owned duplicate key; retry is safe', async () => {
  docs.clear(); docs.set('users/admin',{}); docs.set('users/alice',{});
  const key = createDedupeKey(process.env.DEDUPE_HMAC_SECRET,'alice','venue','2026-10-02');
  docs.set('reports/a',{ownerUid:'alice',restaurantId:'venue',mealDateLocal:'2026-10-02'});
  docs.set('reports/keep',{ownerUid:'alice'}); docs.set('cdcReports/a',{ownerUid:'alice',revision:2});
  docs.set('companionObservations/a',{ownerUid:'alice'}); docs.set(`dedupeKeys/${key}`,{reportId:'a'});
  const reports=[target('symptom','a'),target('cdc','a',2)];
  const result=await run(reports); assert.equal(result.deleted,2); assert.deepEqual(result.processed,['symptom:a','cdc:a']);
  for (const path of ['reports/a','cdcReports/a','companionObservations/a',`dedupeKeys/${key}`]) assert.ok(!docs.has(path));
  assert.ok(docs.has('users/alice')); assert.ok(docs.has('reports/keep'));
  const audit=[...docs.values()].find(d=>d.action==='reports_deleted'); assert.equal(audit.actorUid,'admin'); assert.equal(audit.deleted,2); assert.ok(!('draft' in audit));
  assert.equal((await run(reports)).deleted,0);
});
test('stale revisions or timestamps abort the entire chunk and foreign dedupe keys remain intact', async () => {
  docs.clear(); docs.set('users/admin',{});
  docs.set('cdcReports/first',{ownerUid:'alice',revision:1}); docs.set('cdcReports/stale',{ownerUid:'alice',revision:2});
  await assert.rejects(run([target('cdc','first',1),target('cdc','stale',1)]),e=>e.code==='aborted');
  assert.ok(docs.has('cdcReports/first')); assert.ok(docs.has('cdcReports/stale'));
  const key=createDedupeKey(process.env.DEDUPE_HMAC_SECRET,'alice','venue','2026-10-02');
  docs.set('reports/a',{ownerUid:'alice',restaurantId:'venue',mealDateLocal:'2026-10-02',updatedAt:{toDate:()=>new Date('2026-10-02T00:00:00Z')}});
  docs.set(`dedupeKeys/${key}`,{reportId:'different'});
  await assert.rejects(run([target('symptom','a')]),e=>e.code==='aborted');
  await run([{...target('symptom','a'),updatedAt:'2026-10-02T00:00:00.000Z'}]);
  assert.ok(docs.has(`dedupeKeys/${key}`));
});
