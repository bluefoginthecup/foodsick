import assert from "node:assert/strict";
import { mock, test } from "node:test";
const docs = new Map(); let serial = 0; let failBatch = false;
const snapshot = (path) => ({ id: path.split('/').at(-1), ref: ref(path), exists: docs.has(path), data: () => docs.get(path), get: (key) => docs.get(path)?.[key] });
function ref(path) { return { path, get: async () => snapshot(path) }; }
function collection(name, field, value, limit = 400) {
  return { doc: (id = `generated_${++serial}`) => ref(`${name}/${id}`), where: (f, op, v) => collection(name, f, v, limit), limit: (n) => collection(name, field, value, n),
    get: async () => { const result = [...docs.keys()].filter(p => p.startsWith(`${name}/`) && (!field || docs.get(p)[field] === value)).slice(0, limit).map(snapshot); return { docs: result, size: result.length }; } };
}
const apply = { get: (r) => r.get(), delete: (r) => docs.delete(r.path), update: (r, data) => docs.set(r.path, { ...docs.get(r.path), ...data }), set: (r, data) => docs.set(r.path, data), create: (r, data) => docs.set(r.path, data) };
mock.module("../lib/firebase.js", { namedExports: { db: { collection, runTransaction: async fn => fn(apply), batch: () => { const paths = []; return { delete: r => paths.push(r.path), commit: async () => { if (failBatch) { failBatch = false; throw new Error('temporary failure'); } paths.forEach(p => docs.delete(p)); } }; } } } });
const authActions = [];
mock.module("firebase-admin/auth", { namedExports: { getAuth: () => ({ updateUser: async uid => authActions.push(['disable',uid]), revokeRefreshTokens: async uid => authActions.push(['revoke',uid]), deleteUser: async uid => authActions.push(['delete',uid]) }) } });
process.env.DEDUPE_HMAC_SECRET = "isolated-test-secret-at-least-32-characters";
const { deleteMyReport } = await import("../lib/reports.js");
const { withdrawMyAccount, eraseAccount } = await import("../lib/withdrawal.js");
const { createDedupeKey } = await import("../lib/domain/keys.js");
const auth = { uid: "alice", token: {} };
test("report deletion checks ownership, removes companions and releases duplicate key", async () => {
  docs.clear(); docs.set('users/alice', {});
  const key = createDedupeKey(process.env.DEDUPE_HMAC_SECRET, 'alice', 'kakao_1', '2026-10-01');
  docs.set('reports/own', { ownerUid: 'alice', restaurantId: 'kakao_1', mealDateLocal: '2026-10-01' });
  docs.set('reports/other', { ownerUid: 'bob' });
  docs.set('companionObservations/own', { ownerUid: 'alice' }); docs.set(`dedupeKeys/${key}`, { reportId: 'own' });
  await assert.rejects(deleteMyReport.run({ auth, data: { reportId: 'other' } }), e => e.code === 'permission-denied');
  await deleteMyReport.run({ auth, data: { reportId: 'own' } });
  assert.ok(!docs.has('reports/own')); assert.ok(!docs.has('companionObservations/own')); assert.ok(!docs.has(`dedupeKeys/${key}`));
  assert.ok(docs.has('reports/other'));
  assert.ok([...docs.values()].some(d => d.action === 'report_deleted' && d.ownerUid === 'alice'));
  await deleteMyReport.run({ auth, data: { reportId: 'own' } });
});
test("withdrawal locks account, resumes failed cleanup and never removes another member", async () => {
  docs.clear(); docs.set('users/alice', { nickname: 'A' }); docs.set('users/bob', { nickname: 'B' });
  for (const name of ['reports','companionObservations','dedupeKeys','memberActivities']) {
    docs.set(`${name}/a`, { ownerUid: 'alice' }); docs.set(`${name}/b`, { ownerUid: 'bob' });
  }
  docs.set('rateLimits/a', { uid: 'alice' }); docs.set('kakaoAuthExchanges/a', { uid: 'alice' });
  await assert.rejects(withdrawMyAccount.run({ auth, data: { confirmation: 'wrong' } }), e => e.code === 'invalid-argument');
  await withdrawMyAccount.run({ auth, data: { confirmation: '탈퇴' } });
  assert.equal(docs.get('users/alice').status, 'deleting');
  assert.ok(docs.has('accountDeletionJobs/alice'));
  failBatch = true; await assert.rejects(eraseAccount('alice'));
  assert.ok(docs.has('accountDeletionJobs/alice'));
  await eraseAccount('alice');
  assert.ok(!docs.has('users/alice')); assert.ok(!docs.has('accountDeletionJobs/alice'));
  assert.ok(![...docs.values()].some(d => d.uid === 'alice' || d.ownerUid === 'alice'));
  assert.equal(docs.get('users/bob').nickname, 'B'); assert.ok(docs.has('reports/b'));
  assert.ok(authActions.some(([action, uid]) => action === 'revoke' && uid === 'alice'));
});
