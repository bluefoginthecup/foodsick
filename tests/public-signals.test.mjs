import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parsePublicSignals, signalDateRange, sumSignalDetails, summarizeSignalDetail, recentConcentrations } from "../app/public-signals.ts";

test('recent notices expire after seven Korean calendar days and use one latest case per region and category',()=>{
 const base={region:'영덕1동',category:'냉면',independentReports:3,mealStartDate:'2026-09-26',mealEndDate:'2026-09-27'};
 assert.equal(recentConcentrations([base],new Date('2026-10-02T14:59:59Z')).length,1);
 assert.equal(recentConcentrations([base],new Date('2026-10-02T15:00:00Z')).length,0);
 const latest={...base,mealStartDate:'2026-10-01',mealEndDate:'2026-10-02'};
 assert.deepEqual(recentConcentrations([base,latest],new Date('2026-10-02T03:00:00Z')),[latest]);
});

test('regional health totals preserve known values without treating small or unknown groups as zero', () => {
  assert.deepEqual(summarizeSignalDetail([{outpatientVisits:0}], 'outpatientVisits'), {known:0,smallGroups:0,unknown:false});
  assert.deepEqual(summarizeSignalDetail([{outpatientVisits:5},{outpatientVisits:null,smallDetails:['outpatientVisits']},{outpatientVisits:null}], 'outpatientVisits'), {known:5,smallGroups:1,unknown:true});
});

test("public signal adapter preserves suppression and rejects partial or old-format responses", () => {
  const signal = { id: "x", region: "경기도 용인시 기흥구", sido: "경기도", city: "용인시", district: "기흥구", dong: "",
    category: "냉면", observedAt: "2026-10-02", independentReports: 3, companionSymptoms: null, medicalVisits: 2, privacyLevel: "gu", privacyPolicyVersion: "privacy-v1" };
  const [parsed] = parsePublicSignals([signal]);
  assert.equal(parsed.medicalVisits, null);
  assert.equal(sumSignalDetails([parsed, { ...parsed, companionSymptoms: 5 }], "companionSymptoms"), null);
  assert.deepEqual(parsePublicSignals([]), []);
  assert.throws(() => parsePublicSignals([{ displayRegion: "legacy" }]));
  assert.throws(() => parsePublicSignals([{ ...signal, independentReports: 1 }]));
  assert.equal(signalDateRange(new Date("2026-10-01T15:01:00Z")).end, "2026-10-02");
});

test("region list includes nested districts, Seoul, counties and Sejong without defaults", async () => {
  const { regions } = JSON.parse(await readFile(new URL("../public/administrative-regions.json", import.meta.url), "utf8"));
  assert.ok(regions["경기도"]["용인시 기흥구"].includes("영덕1동"));
  assert.ok(regions["서울특별시"]["은평구"].includes("진관동"));
  assert.ok(regions["전북특별자치도"]["부안군"].includes("부안읍"));
  assert.ok(Object.values(regions["세종특별자치시"]).flat().length > 0);
});
