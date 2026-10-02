import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const records = new Map();
const snapshot = path => ({ id: path.split("/")[1], exists: records.has(path), data: () => records.get(path), get: key => records.get(path)?.[key] });
const ref = path => ({ path, id: path.split("/")[1], get: async () => snapshot(path) });
function query(collection, filters = [], count = Infinity, cursor = null) {
  return {
    doc: id => ref(`${collection}/${id}`),
    orderBy: () => query(collection, filters, count, cursor),
    where: (field, op, value) => { assert.equal(op, "=="); return query(collection, [...filters, [field, value]], count, cursor); },
    limit: n => query(collection, filters, n, cursor),
    startAfter: doc => query(collection, filters, count, doc.id),
    get: async () => {
      let docs = [...records.keys()].filter(path => path.startsWith(`${collection}/`)).map(snapshot)
        .filter(doc => filters.every(([field, value]) => doc.get(field) === value)).sort((a, b) => b.id.localeCompare(a.id));
      if (cursor) docs = docs.filter(doc => doc.id.localeCompare(cursor) < 0);
      docs = docs.slice(0, count);
      return { docs, size: docs.length };
    },
  };
}
mock.module("../lib/firebase.js", { namedExports: { db: {
  collection: name => query(name),
  runTransaction: async fn => {
    const writes = [];
    const result = await fn({
      get: r => { assert.equal(writes.length, 0, "Firestore reads must precede writes"); return r.get(); },
      set: (r, d) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...d })),
      update: (r, d) => writes.push(() => records.set(r.path, { ...records.get(r.path), ...d })),
      delete: r => writes.push(() => records.delete(r.path)),
    });
    writes.forEach(write => write()); return result;
  },
} } });
const { saveResourcePost: save, listResourcePosts: list, reviewResourcePost: review, deleteResourcePost: remove } = await import("../lib/resource-posts.js");
const alice = { uid: "alice", token: {} };
const bob = { uid: "bob", token: {} };
const admin = { uid: "admin", token: { role: "admin" } };
const draft = { type: "논문·연구", language: "한국어", title: "시민 참여 연구", source: "연구기관", description: "논문 소개", takeaway: "연구의 한계", url: "https://example.org/paper", tags: ["연구"] };
const saveData = (revision = 0) => ({ id: "post-1", revision, draft });
const post = () => records.get("resourcePosts/post-1");
const code = expected => error => error.code === expected;
beforeEach(() => { records.clear(); for (const uid of ["alice", "bob", "admin"]) records.set(`users/${uid}`, {}); });

test("members cannot forge publication, ownership, or moderation permissions", async () => {
  await assert.rejects(save.run({ data: saveData() }), code("unauthenticated"));
  await save.run({ auth: alice, data: { ...saveData(), status: "approved", ownerUid: "bob", role: "admin" } });
  assert.equal(post().ownerUid, "alice"); assert.equal(post().status, "pending");
  assert.equal((await list.run({ data: {} })).posts.length, 0);
  assert.equal((await list.run({ auth: alice, data: { scope: "mine" } })).posts.length, 1);
  assert.equal((await list.run({ auth: bob, data: { scope: "mine" } })).posts.length, 0);
  await assert.rejects(list.run({ data: { scope: "mine" } }), code("unauthenticated"));
  await assert.rejects(list.run({ auth: alice, data: { scope: "admin" } }), code("permission-denied"));
  await assert.rejects(review.run({ auth: alice, data: { id: "post-1", revision: 1, status: "approved" } }), code("permission-denied"));
  await assert.rejects(save.run({ auth: bob, data: saveData(1) }), code("permission-denied"));
  await assert.rejects(remove.run({ auth: bob, data: { id: "post-1", revision: 1 } }), code("permission-denied"));
});

test("approval publishes only safe fields and any member edit requires reapproval", async () => {
  await save.run({ auth: alice, data: saveData() });
  await review.run({ auth: admin, data: { id: "post-1", revision: 1, status: "approved", note: "private review" } });
  const published = (await list.run({ data: { scope: "public" } })).posts;
  assert.equal(published.length, 1);
  for (const key of ["ownerUid", "reviewNote", "reviewedBy", "revision", "status"]) assert.equal(published[0][key], undefined);
  assert.equal(post().revision, 2);
  await assert.rejects(save.run({ auth: alice, data: saveData(1) }), code("aborted"));
  await save.run({ auth: alice, data: saveData(2) });
  assert.equal(post().status, "pending"); assert.equal(post().reviewNote, "");
  assert.equal((await list.run({ data: {} })).posts.length, 0);
  await assert.rejects(review.run({ auth: admin, data: { id: "post-1", revision: 2, status: "approved" } }), code("aborted"));
  await review.run({ auth: admin, data: { id: "post-1", revision: 3, status: "rejected", note: "출처를 보완해주세요" } });
  const mine = (await list.run({ auth: alice, data: { scope: "mine" } })).posts[0];
  assert.equal(mine.status, "rejected"); assert.equal(mine.reviewNote, "출처를 보완해주세요");
  await save.run({ auth: alice, data: saveData(4) });
  assert.equal(post().status, "pending");
});

test("administrator publishes and edits any post, can hide and delete; stale deletes fail", async () => {
  await save.run({ auth: alice, data: saveData() });
  await save.run({ auth: admin, data: saveData(1) });
  assert.equal(post().ownerUid, "alice"); assert.equal(post().status, "approved");
  await assert.rejects(review.run({ auth: admin, data: { id: "post-1", revision: 2, status: "rejected", note: " " } }), code("invalid-argument"));
  await review.run({ auth: admin, data: { id: "post-1", revision: 2, status: "rejected", note: "공개 취소" } });
  assert.equal((await list.run({ data: {} })).posts.length, 0);
  await assert.rejects(remove.run({ auth: admin, data: { id: "post-1", revision: 2 } }), code("aborted"));
  await remove.run({ auth: admin, data: { id: "post-1", revision: 3 } });
  assert.equal(post(), undefined);
  await save.run({ auth: admin, data: saveData() });
  assert.equal(post().status, "approved");
});

test("validates content, link protocols, revisions and active account sessions", async () => {
  for (const invalid of [{ url: "javascript:alert(1)" }, { url: "https://user:password@example.org" }, { type: "forged" }, { title: " " }, { description: "a".repeat(5001) }, { tags: Array(7).fill("tag") }, { year: "abcd" }]) {
    await assert.rejects(save.run({ auth: alice, data: { ...saveData(), draft: { ...draft, ...invalid } } }), code("invalid-argument"));
  }
  await assert.rejects(save.run({ auth: alice, data: saveData(-1) }), code("invalid-argument"));
  records.set("users/alice", { status: "deleting" });
  await assert.rejects(save.run({ auth: alice, data: saveData() }), code("unauthenticated"));
  records.set("users/alice", { sessionVersion: "new" });
  await assert.rejects(save.run({ auth: alice, data: saveData() }), code("unauthenticated"));
  assert.equal(post(), undefined);
});

test("pagination never includes pending posts, and cursors cannot expose private documents", async () => {
  for (let i = 0; i < 32; i++) await save.run({ auth: admin, data: { ...saveData(), id: `public-${String(i).padStart(2, "0")}` } });
  await save.run({ auth: alice, data: saveData() });
  const first = await list.run({ data: {} });
  const second = await list.run({ data: { cursor: first.nextCursor } });
  assert.equal(first.posts.length, 30); assert.equal(second.posts.length, 2); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.posts, ...second.posts].map(p => p.id)).size, 32);
  await assert.rejects(list.run({ data: { cursor: "post-1" } }), code("invalid-argument"));
  await assert.rejects(list.run({ auth: bob, data: { scope: "mine", cursor: "post-1" } }), code("invalid-argument"));
});

test("member daily posting limit does not block edits or own deletion", async () => {
  for (let i = 0; i < 20; i++) await save.run({ auth: alice, data: { ...saveData(), id: `post-${i}` } });
  await assert.rejects(save.run({ auth: alice, data: { ...saveData(), id: "excess" } }), code("resource-exhausted"));
  await save.run({ auth: alice, data: saveData(1) });
  await remove.run({ auth: alice, data: { id: "post-1", revision: 2 } });
  assert.equal(post(), undefined);
});
