import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { Timestamp } from "firebase-admin/firestore";
let reads = 0;
let offset = 0;
const records = Array.from({ length: 51 }, (_, index) => ({ id: `report_${index}`, exists: true, data: () => ({ ownerUid: `owner_${index}`, status: "submitted", draft: { menu: "작성한 메뉴", otherSymptom: "직접 적은 증상", companions: [{ otherUnderlyingCondition: "동행자 원문" }] }, createdAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(2000), sensitiveDataConsentVersion: "consent-v1" }) }));
const query = { orderBy: () => query, startAfter: (doc) => { offset = records.findIndex(r => r.id === doc.id) + 1; return query; }, limit: () => query, get: async () => { reads++; return { docs: records.slice(offset) }; }, doc: (id) => ({ get: async () => records.find(r => r.id === id) ?? { exists: false } }) };
mock.module("../lib/firebase.js", { namedExports: { db: { collection: () => query } } });
const { getAdminReports } = await import("../lib/admin-reports.js");
test("anonymous and ordinary users cannot read any admin report data", async () => {
  for (const auth of [undefined, { uid: "user", token: { role: "user" } }]) {
    await assert.rejects(getAdminReports.run({ data: {}, auth }), e => ["unauthenticated", "permission-denied"].includes(e.code));
  }
  assert.equal(reads, 0);
});
test("admin receives full written fields from all owners, with paging and input validation", async () => {
  const auth = { uid: "admin", token: { role: "admin" } };
  const first = await getAdminReports.run({ auth, data: {} });
  assert.equal(first.reports.length, 50);
  assert.equal(first.nextCursor, "report_49");
  assert.equal(first.reports[0].draft.otherSymptom, "직접 적은 증상");
  assert.equal(first.reports[0].draft.companions[0].otherUnderlyingCondition, "동행자 원문");
  assert.equal(first.reports[0].ownerUid, "owner_0");
  const next = await getAdminReports.run({ auth, data: { cursor: first.nextCursor } });
  assert.equal(next.reports.length, 1);
  assert.equal(next.nextCursor, null);
  await assert.rejects(getAdminReports.run({ auth, data: { cursor: "bad/path" } }), e => e.code === "invalid-argument");
});
