import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { validateCdcDraft, emptyCdcDraft } from "../lib/domain/cdc.js";
const valid = () => ({ ...emptyCdcDraft(), symptoms: ["설사"], basic: { onsetPrecision: "unknown", suspectedMeal: "unknown", medical: "unknown", hospitalized: "no", tested: "unknown" }, consent: true });
test("CDC intake allows an unknown source and onset without invented dates", () => {
  const result = validateCdcDraft(valid());
  assert.deepEqual(result.issues, []);
  assert.equal(result.draft.basic.onsetDate, undefined);
  assert.equal(result.draft.basic.medical, "unknown");
  assert.equal(result.draft.detail.illContact, undefined);
});
test("CDC rejects invalid dates, counts, enumerations and absent health consent", () => {
  for (const [field, value] of [["onsetDate", "2026-02-30"], ["onsetTime", "25:00"], ["partyTotal", "-1"], ["partyTotal", "1.5"], ["tested", "invented"]]) {
    const draft = valid(); draft.basic[field] = value;
    assert.ok(validateCdcDraft(draft).issues.some(i => i.field === `basic.${field}`));
  }
  const draft = valid(); draft.basic.partyTotal = "2"; draft.basic.partySick = "3"; draft.consent = false;
  const issues = validateCdcDraft(draft).issues;
  assert.ok(issues.some(i => i.field === "basic.partySick"));
  assert.ok(issues.some(i => i.field === "consent"));
});
test("CDC conditional fields and detail limits are validated without treating unanswered as no", () => {
  const draft = valid(); draft.basic.onsetPrecision = "exact"; draft.basic.suspectedMeal = "yes";
  assert.ok(validateCdcDraft(draft).issues.some(i => i.field === "basic.onsetDate"));
  assert.ok(validateCdcDraft(draft).issues.some(i => i.field === "basic.source"));
  const full = valid(); full.detail = { illContact: "maybe", animals: "declined", notes: "기록", ownerUid: "forged" }; full.meals = [{ foods: "샐러드", preparation: "raw" }];
  const checked = validateCdcDraft(full);
  assert.deepEqual(checked.issues, []);
  assert.equal(checked.draft.detail.illContact, "maybe");
  assert.equal(checked.draft.detail.ownerUid, undefined);
  full.meals = Array.from({ length: 31 }, () => ({}));
  assert.ok(validateCdcDraft(full).issues.some(i => i.field === "meals"));
});
const records = new Map([["users/alice", {}], ["users/bob", {}], ["users/admin", {}]]);
let sequence = 0;
const ref = (collection, id = `generated${++sequence}`) => ({ id, path: `${collection}/${id}`, get: async () => snapshot(collection, id) });
const snapshot = (collection, id) => ({ id, exists: records.has(`${collection}/${id}`), data: () => records.get(`${collection}/${id}`), get: k => records.get(`${collection}/${id}`)?.[k] });
mock.module("../lib/firebase.js", { namedExports: { db: {
  collection: name => ({ doc: id => ref(name, id) }),
  runTransaction: async fn => {
    const writes = [];
    const result = await fn({ get: r => r.get(), set: (r, d) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...d })), update: (r, d) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...d })), create: (r, d) => writes.push(() => records.set(r.path, d)), delete: r => writes.push(() => records.delete(r.path)) });
    writes.forEach(fn => fn()); return result;
  },
} } });
const { saveCdcReport, listCdcReports, deleteCdcReport, reviewCdcReport } = await import("../lib/cdc-reports.js");
const auth = { uid: "alice", token: {} };
test("CDC requires authentication and enforces owner, version and administrator boundaries", async () => {
  await assert.rejects(saveCdcReport.run({ data: {} }), e => e.code === "unauthenticated");
  const data = { id: "cdc-test", revision: 0, draft: valid(), ownerUid: "bob" };
  await saveCdcReport.run({ auth, data });
  assert.equal(records.get("cdcReports/cdc-test").ownerUid, "alice");
  assert.equal([...records.keys()].some(k => k.startsWith("reports/")), false);
  await assert.rejects(saveCdcReport.run({ auth, data }), e => e.code === "aborted");
  const bob = { uid: "bob", token: {} };
  await assert.rejects(saveCdcReport.run({ auth: bob, data: { ...data, revision: 1 } }), e => e.code === "permission-denied");
  await assert.rejects(listCdcReports.run({ auth: bob, data: { id: data.id } }), e => e.code === "not-found");
  await assert.rejects(listCdcReports.run({ auth, data: { admin: true } }), e => e.code === "permission-denied");
  await assert.rejects(deleteCdcReport.run({ auth: bob, data: { id: data.id } }), e => e.code === "not-found");
  await assert.rejects(reviewCdcReport.run({ auth, data: { id: data.id, revision: 1, note: "" } }), e => e.code === "permission-denied");
  const admin = { uid: "admin", token: { role: "admin" } };
  await reviewCdcReport.run({ auth: admin, data: { id: data.id, revision: 1, note: "검토함" } });
  assert.equal(records.get("cdcReports/cdc-test").status, "reviewed");
  await saveCdcReport.run({ auth, data: { ...data, revision: 1 } });
  assert.equal(records.get("cdcReports/cdc-test").status, "submitted");
  await assert.rejects(reviewCdcReport.run({ auth: admin, data: { id: data.id, revision: 1, note: "" } }), e => e.code === "aborted");
  await deleteCdcReport.run({ auth, data: { id: data.id } });
  assert.equal(records.has("cdcReports/cdc-test"), false);
});
test("CDC blocks writes while the member is withdrawing", async () => {
  records.set("users/alice", { status: "deleting" });
  await assert.rejects(saveCdcReport.run({ auth, data: { id: "blocked", revision: 0, draft: valid() } }), e => e.code === "unauthenticated");
  assert.equal(records.has("cdcReports/blocked"), false);
});
