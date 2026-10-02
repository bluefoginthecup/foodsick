import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyRows,publicHistory} from '../lib/domain/report-history.js';
const region={sido:'경기도',city:'용인시',district:'기흥구',dong:'영덕1동',code:'4146357000',level:'dong',sameCategoryVenueCount:6};
const regions=new Map([['냉면',region]]);
const report=(id,extra={})=>({id,ownerUid:id,canonicalRestaurantId:'private-venue',mealAt:'2026-08-01T15:00:00Z',symptomOnsetAt:'2026-08-02T06:00:00Z',symptoms:['설사'],foodCategory:'냉면',partySymptomatic:0,medicalVisit:false,hospitalized:false,status:'submitted',...extra});
test('history includes isolated old reports, uses Korean meal date and preserves same owner different meals',()=>{
 const rows=historyRows([report('one'),report('two',{ownerUid:'one',mealAt:'2026-08-10T00:00:00Z',symptomOnsetAt:'2026-08-10T06:00:00Z'})],regions);
 assert.equal(rows.length,2);assert.equal(rows[0].date,'2026-08-02');
 assert.deepEqual(publicHistory(rows).map(r=>r.independentReports),[1,1]);
});
test('different venues combine before publication; excluded and unverifiable reports never enter history',()=>{
 const first=historyRows([report('one',{medicalVisit:true})],regions);
 const second=historyRows([report('two',{canonicalRestaurantId:'other-private-venue',medicalVisit:true}),report('three',{medicalVisit:true}),report('excluded',{status:'rejected'})],regions);
 const [view]=publicHistory([...first,...second]);
 assert.equal(view.independentReports,3); assert.equal(view.outpatientVisits,3);assert.equal(view.inpatientVisits,0);
 assert.equal(view.canonicalRestaurantId,undefined);assert.equal(view.ownerUid,undefined);assert.equal(view.reportIds,undefined);
 assert.equal(historyRows([report('x')],new Map()).length,0);
 assert.equal(publicHistory(historyRows([report('x',{medicalVisit:true})],regions))[0].outpatientVisits,null);
});
