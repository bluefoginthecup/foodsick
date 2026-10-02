import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test, mock } from "node:test";
import { Timestamp } from "firebase-admin/firestore";

// An isolated transactional store: production reports are never used as test data.
const documents = new Map();
let revision = 0;
let beforeTransaction;
const put = (path, data) => documents.set(path, { data, version: ++revision });
const snapshot = (path) => ({
  id: path.split("/").at(-1), ref: ref(path),
  get exists() { return documents.has(path); },
  data: () => documents.get(path)?.data,
  get: (key) => documents.get(path)?.data[key],
  updateTime: new Timestamp(documents.get(path)?.version ?? 0, 0),
});
function ref(path) {
  return { path, get: async () => snapshot(path), set: async (data) => put(path, data) };
}
function collection(name, filters = [], maximum = Infinity) {
  return {
    doc: (id) => ref(`${name}/${id}`),
    where: (key, op, value) => collection(name, [...filters, [key, op, value]], maximum),
    orderBy: () => collection(name, filters, maximum),
    limit: (n) => collection(name, filters, n),
    get: async () => {
      const docs = [...documents].filter(([path, { data }]) => path.startsWith(`${name}/`) && filters.every(([key, op, value]) =>
        op === "==" ? data[key] === value : data[key].toMillis() >= value.toMillis()))
        .slice(0, maximum).map(([path]) => snapshot(path));
      return { docs, size: docs.length };
    },
  };
}
const db = {
  collection,
  getAll: async (...refs) => refs.map(r => snapshot(r.path)),
  runTransaction: async (fn) => {
    beforeTransaction?.(); beforeTransaction = undefined;
    const changes = [];
    await fn({ get: (target) => target.get(), set: (target, data) => changes.push(() => put(target.path, data)), delete: (target) => changes.push(() => documents.delete(target.path)) });
    changes.forEach((change) => change());
  },
};
mock.module("../lib/firebase.js", { namedExports: { db } });
process.env.DEDUPE_HMAC_SECRET = "isolated-test-secret-not-for-production";
process.env.KAKAO_REST_API_KEY = "isolated-test-key";
const { rebuildRestaurantSignals, syncReportSignals } = await import("../lib/signal-publisher.js");
const hash = (s) => createHash("sha256").update(s).digest("hex");

function seed() {
  documents.clear();
  const now = Date.now();
  put(`signalPrivacyChecks/${hash("kakao_200:냉면")}`, {region:null,expiresAt:Timestamp.fromMillis(now+3600_000)});
  for (const id of ["one", "two", "three"]) put(`users/${id}`, {status:"active",provider:"kakao"});
  for (const id of ["one", "two", "three"]) put(`reports/${id}`, {
    ownerUid: id, restaurantId: "kakao_100", foodCategory: "냉면", status: "submitted", symptoms: ["설사"],
    mealAt: Timestamp.fromMillis(now - 86400_000), symptomOnsetAt: Timestamp.fromMillis(now - 80000_000),
    partySymptomatic: 0, medical: { visited: false },
  });
  put(`signalPrivacyChecks/${hash("kakao_100:냉면")}`, { region: { sido: "경기도", city: "용인시", district: "기흥구", dong: "", code: "41463", level: "gu", sameCategoryVenueCount: 3 }, expiresAt: Timestamp.fromMillis(now + 3600_000) });
}
const publicDocs = () => [...documents.keys()].filter((path) => path.startsWith("publicSignals/"));

test('isolated history survives below alert threshold, and deletions withdraw its contribution', async () => {
  seed(); documents.delete('reports/two'); documents.delete('reports/three');
  await rebuildRestaurantSignals('kakao_100');
  assert.equal(publicDocs().length,0);
  const path=`reportHistoryContributions/${hash('kakao_100')}`;
  assert.equal(documents.get(path).data.rows[0].count,1);
  assert.deepEqual(documents.get(path).data.recent,[]);
  documents.delete('reports/one');
  await rebuildRestaurantSignals('kakao_100');
  assert.deepEqual(documents.get(path).data.rows,[]);
});

test("publication is idempotent and an excluded report withdraws the existing signal", async () => {
  seed();
  await rebuildRestaurantSignals("kakao_100");
  const initial = publicDocs();
  assert.equal(initial.length, 1);
  await rebuildRestaurantSignals("kakao_100");
  assert.deepEqual(publicDocs(), initial);
  const changed = documents.get("reports/three").data;
  put("reports/three", { ...changed, status: "rejected" });
  await syncReportSignals.run({ data: { before: { get: () => "kakao_100" }, after: { get: () => "kakao_100" } } });
  assert.equal(publicDocs().length, 0);
});

test("concurrent edits cannot publish stale counts and restaurant changes clear old signals", async () => {
  seed();
  beforeTransaction = () => { const data = documents.get("reports/three").data; put("reports/three", { ...data, status: "rejected" }); };
  await assert.rejects(() => rebuildRestaurantSignals("kakao_100"), /Reports changed/);
  assert.equal(publicDocs().length, 0);
  seed();
  await rebuildRestaurantSignals("kakao_100");
  put("reports/three", { ...documents.get("reports/three").data, restaurantId: "kakao_200" });
  await syncReportSignals.run({ data: { before: { get: () => "kakao_100" }, after: { get: () => "kakao_200" } } });
  assert.equal(publicDocs().length, 0);
});

test("loss of verified privacy evidence withdraws previously published data", async () => {
  seed();
  await rebuildRestaurantSignals("kakao_100");
  put(`signalPrivacyChecks/${hash("kakao_100:냉면")}`, { region: null, expiresAt: Timestamp.fromMillis(Date.now() + 3600_000) });
  await rebuildRestaurantSignals("kakao_100");
  assert.equal(publicDocs().length, 0);
});

test("all active identities contribute equally; missing and withdrawing identities do not", async () => {
 seed(); put('users/three',{status:'active',isTest:true,testBatchId:'b'});
 await rebuildRestaurantSignals('kakao_100');assert.equal(publicDocs().length,1);
 documents.delete('reports/three');await rebuildRestaurantSignals('kakao_100');assert.equal(publicDocs().length,0);
 seed();documents.delete('users/three');
 await rebuildRestaurantSignals('kakao_100');assert.equal(publicDocs().length,0);
 seed();put('users/three',{status:'deleting'});
 await rebuildRestaurantSignals('kakao_100');assert.equal(publicDocs().length,0);
});

test('registered fictional venues publish on the same public collection and removal withdraws them',async()=>{
 seed();const batch='11111111-1111-4111-8111-111111111111';const venue=`manual_test_${batch}_v2_0`;
 put(`testBatches/${batch}`,{scenarioVersion:2,status:'active'});
 for(const id of ['one','two','three'])put(`reports/${id}`,{...documents.get(`reports/${id}`).data,restaurantId:venue});
 await rebuildRestaurantSignals(venue);assert.equal(publicDocs().length,1);
 documents.delete('reports/three');await rebuildRestaurantSignals(venue);assert.equal(publicDocs().length,0);
});
