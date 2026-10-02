import assert from 'node:assert/strict';
import test from 'node:test';
import { testScenario, realisticTestScenario } from '../app/admin/test-scenarios.ts';
import { validateReportInput } from '../functions/src/domain/report.ts';
test('all 100 distinct scenarios pass the actual server validator and use fictional venues', () => {
  const drafts = Array.from({ length: 100 }, (_, index) => testScenario('11111111-1111-4111-8111-111111111111', '2026-10-01', index));
  for (const draft of drafts) {
    assert.doesNotThrow(() => validateReportInput({ ...draft, sensitiveDataConsentVersion: 'consent-v1' }));
    assert.ok(draft.restaurantInternalId.startsWith('manual_test_'));
  }
  assert.equal(new Set(drafts.map(d => JSON.stringify(d))).size, 100);
  assert.equal(drafts[0].restaurantInternalId, drafts[2].restaurantInternalId);
  assert.notEqual(drafts[0].restaurantInternalId, drafts[3].restaurantInternalId);
  assert.equal(drafts.filter(d => d.companions.length).length, 20);
});

test('100 new scenarios validate and have exact grouped evidence and diverse places', () => {
 const drafts=Array.from({length:100},(_,i)=>realisticTestScenario('11111111-1111-4111-8111-111111111111','2026-10-01',i));
 for(const draft of drafts)assert.doesNotThrow(()=>validateReportInput({...draft,sensitiveDataConsentVersion:'consent-v1'}));
 assert.ok(new Set(drafts.map(d=>d.province)).size>=5);
 assert.ok(new Set(drafts.map(d=>d.mealDate)).size>=20);
 assert.equal(drafts[0].restaurantInternalId,drafts[2].restaurantInternalId);
 assert.notEqual(drafts[29].restaurantInternalId,drafts[30].restaurantInternalId);
 assert.ok(drafts.every(d=>d.publicMenus.length===1));
});

test('full 100-member exercise ends with 90 reports, 14 candidates and 9 signals', async () => {
 const {evaluateSignals}=await import('../functions/lib/domain/signal-evaluation.js');
 const {chooseSafeRegion}=await import('../functions/lib/domain/public-signal.js');
 const {fixtureFor}=await import('../functions/lib/domain/test-fixtures.js');
 const batch='11111111-1111-4111-8111-111111111111';
 const groups=new Map();
 for(let i=0;i<90;i++){
  const r=validateReportInput({...realisticTestScenario(batch,'2026-10-01',i),sensitiveDataConsentVersion:'consent-v1'});
  const list=groups.get(r.restaurantInternalId)??[];
  list.push({id:String(i),ownerUid:String(i),canonicalRestaurantId:r.restaurantInternalId,foodCategory:r.foodCategory,mealAt:r.mealAt.toISOString(),symptomOnsetAt:r.symptomOnsetAt.toISOString(),symptoms:r.symptoms,partySymptomatic:r.partySymptomatic,medicalVisit:r.medicalVisit,status:'submitted',publicMenus:r.publicMenus});
  groups.set(r.restaurantInternalId,list);
 }
 let candidates=0,signals=0;
 for(const [id,rows] of groups){const f=fixtureFor(id,batch);const result=evaluateSignals(rows,new Map([[f.category,f.verified?chooseSafeRegion(f.regions):null]]),id=>id);candidates+=result.candidates.length;signals+=result.signals.length;}
 assert.equal(candidates,14);assert.equal(signals,9);
});
