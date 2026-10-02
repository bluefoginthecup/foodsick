import assert from "node:assert/strict";
import { mock, test } from "node:test";
const records = new Map([["alice", { nickname: "원래별명", role: "admin", privateToken: "must-not-return" }], ["bob", { nickname: "다른회원" }]]);
const ref = (uid) => ({ uid, get: async () => ({ exists: records.has(uid), data: () => records.get(uid) }) });
mock.module("../lib/firebase.js", { namedExports: { db: {
  collection: () => ({ doc: ref }),
  runTransaction: async (fn) => fn({ create: () => {}, get: (doc) => doc.get(), update: (doc, patch) => records.set(doc.uid, { ...records.get(doc.uid), ...patch }) }),
} } });
const { getMyAccount, updateMyAccount } = await import("../lib/account.js");
const auth = { uid: "alice", token: {} };
test("account reads require login and only return the signed-in account allowlist", async () => {
  await assert.rejects(getMyAccount.run({ data: {} }), e => e.code === "unauthenticated");
  const account = await getMyAccount.run({ auth, data: { uid: "bob" } });
  assert.equal(account.uid, "alice");
  assert.equal(account.nickname, "원래별명");
  assert.equal(account.privateToken, undefined);
  assert.equal(account.role, undefined);
});
test("profile changes cannot target another user or change permissions", async () => {
  await assert.rejects(updateMyAccount.run({ data: { nickname: "x" } }), e => e.code === "unauthenticated");
  for (const data of [{ nickname: "x", uid: "bob" }, { nickname: "x", role: "admin" }, { nickname: "x".repeat(31) }, { nickname: "a\nb" }]) {
    await assert.rejects(updateMyAccount.run({ auth, data }), e => e.code === "invalid-argument");
  }
  await updateMyAccount.run({ auth, data: { nickname: " 새별명 " } });
  assert.equal(records.get("alice").nickname, "새별명");
  assert.equal(records.get("alice").role, "admin");
  assert.equal(records.get("bob").nickname, "다른회원");
  await updateMyAccount.run({ auth, data: { nickname: "" } });
  assert.equal(records.get("alice").nickname, "");
});
