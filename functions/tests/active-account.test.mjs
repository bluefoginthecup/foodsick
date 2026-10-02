import assert from "node:assert/strict";
import { mock, test } from "node:test";
let account = { status: "active" };
mock.module("../lib/firebase.js", { namedExports: { db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: !!account, data: () => account }) }) }) } } });
const { requireUid, requireAdmin } = await import("../lib/common.js");
test("withdrawn, deleting, and old re-registration tokens cannot access accounts or admin data", async () => {
  const request = { auth: { uid: "me", token: { role: "admin" } } };
  assert.equal(await requireUid(request), "me");
  for (const state of [null, { status: "deleting" }, { status: "withdrawn" }, { sessionVersion: "new-account" }]) {
    account = state;
    await assert.rejects(requireUid(request), e => e.code === "unauthenticated");
    await assert.rejects(requireAdmin(request), e => e.code === "unauthenticated");
  }
  assert.equal(await requireUid({ auth: { uid: "me", token: { sessionVersion: "new-account" } } }), "me");
});
