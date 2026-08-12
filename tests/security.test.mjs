import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionReport, securityPolicy } from "../app/security/policy.ts";

test("restricts report status transitions", () => {
  assert.equal(canTransitionReport("submitted", "reviewed"), true);
  assert.equal(canTransitionReport("rejected", "included_in_cluster"), false);
});

test("keeps sensitive writes server-side", () => {
  assert.equal(securityPolicy.reportWritePath, "server-only");
  assert.equal(securityPolicy.publicMapData, "aggregate-only");
  assert.equal(securityPolicy.adminAuthorization, "firebase-custom-claim");
  assert.equal(securityPolicy.appCheck, "required-in-production");
});
