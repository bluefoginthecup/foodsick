import assert from "node:assert/strict";
import test from "node:test";
import { kakaoFirebaseUid, safeReturnTo, sha256Base64Url } from "../src/domain/kakao-auth.ts";

test("accepts only same-site relative return paths", () => {
  assert.equal(safeReturnTo("/my-reports?from=login#top"), "/my-reports?from=login#top");
  assert.equal(safeReturnTo("https://evil.example/steal"), "/report");
  assert.equal(safeReturnTo("//evil.example/steal"), "/report");
  assert.equal(safeReturnTo(undefined), "/report");
});

test("hashes one-time values without retaining the source", () => {
  const raw = "one-time-value-that-must-not-be-stored";
  const digest = sha256Base64Url(raw);
  assert.equal(digest, sha256Base64Url(raw));
  assert.equal(digest.includes(raw), false);
});

test("creates a deterministic private Firebase uid", () => {
  const first = kakaoFirebaseUid("test-secret-long-enough-for-hmac", "123456789");
  const same = kakaoFirebaseUid("test-secret-long-enough-for-hmac", "123456789");
  const other = kakaoFirebaseUid("test-secret-long-enough-for-hmac", "987654321");
  assert.equal(first, same);
  assert.notEqual(first, other);
  assert.equal(first.includes("123456789"), false);
  assert.match(first, /^kakao_[A-Za-z0-9_-]{43}$/);
});

