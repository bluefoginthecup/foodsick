import assert from "node:assert/strict";
import { mock, test } from "node:test";
const docs = new Map();
const snapshot = path => ({ id: path.split('/').at(-1), ref: ref(path), exists: docs.has(path), data: () => docs.get(path), get: key => docs.get(path)?.[key] });
function ref(path) { return { path, get: async () => snapshot(path) }; }
function collection(name, field, value) {
  return { doc: id => ref(`${name}/${id}`), where: (f, _op, v) => collection(name, f, v), orderBy() { return this; }, limit() { return this; },
    get: async () => ({ docs: [...docs.keys()].filter(p => p.startsWith(`${name}/`) && (!field || docs.get(p)[field] === value)).map(snapshot) }) };
}
const tx = { get: r => r.get(), create: (r, d) => docs.set(r.path, d), update: (r, d) => docs.set(r.path, { ...docs.get(r.path), ...d }) };
mock.module("../lib/firebase.js", { namedExports: { db: { collection, runTransaction: async fn => fn(tx) } } });
const tokens = [];
mock.module("firebase-admin/auth", { namedExports: { getAuth: () => ({ createCustomToken: async (uid, claims) => { tokens.push({ uid, claims }); return 'token'; } }) } });
const { manageTestMembers } = await import('../lib/test-members.js');
const id = '11111111-1111-4111-8111-111111111111';
const auth = { uid: 'admin', token: { role: 'admin' } };
const run = data => manageTestMembers.run({ auth, data: { batchId: id, ...data } });
test('only an active administrator can create test members', async () => {
  docs.clear();
  await assert.rejects(manageTestMembers.run({ auth: { uid: 'person', token: {} }, data: { action: 'create', batchId: id, count: 100 } }), e => e.code === 'permission-denied');
  await assert.rejects(run({ action: 'create', count: 100 }), e => e.code === 'unauthenticated');
  docs.set('users/admin', {});
  await assert.rejects(run({ action: 'create', count: 101 }), e => e.code === 'invalid-argument');
});
test('creation is idempotent, tokens are ordinary users, ending locks all and preserves real members', async () => {
  docs.clear(); docs.set('users/admin', {}); docs.set('users/real', { nickname: 'real' });
  await run({ action: 'create', count: 100 });
  await run({ action: 'create', count: 100 });
  const members = (await run({ action: 'list' })).members;
  assert.equal(members.length, 100);
  const uid = members[0].uid;
  await assert.rejects(run({ action: 'token', uid: 'real' }), e => e.code === 'invalid-argument');
  await run({ action: 'token', uid });
  assert.equal(tokens.at(-1).claims.role, 'user');
  assert.equal(tokens.at(-1).claims.provider, 'test');
  assert.ok(tokens.at(-1).claims.sessionVersion);
  await run({ action: 'end' });
  assert.equal(docs.get(`users/${uid}`).status, 'deleting');
  assert.equal([...docs.keys()].filter(p => p.startsWith('accountDeletionJobs/')).length, 100);
  await assert.rejects(run({ action: 'token', uid }), e => e.code === 'permission-denied');
  await run({ action: 'end' });
  assert.equal(docs.get('users/real').nickname, 'real');
});
test('tampered membership cannot issue tokens or bulk-delete real users', async () => {
  docs.clear(); docs.set('users/admin', {});
  await run({ action: 'create', count: 1 });
  const uid = `test_${id}_001`;
  docs.set(`users/${uid}`, { ...docs.get(`users/${uid}`), isTest: false });
  await assert.rejects(run({ action: 'token', uid }), e => e.code === 'permission-denied');
  await assert.rejects(run({ action: 'end' }), e => e.code === 'failed-precondition');
});
