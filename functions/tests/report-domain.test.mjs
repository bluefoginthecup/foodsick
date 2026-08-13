import assert from "node:assert/strict";
import test from "node:test";
import { createDedupeKey, rateLimitBucket } from "../src/domain/keys.ts";
import { InputError, validateReportInput } from "../src/domain/report.ts";

const validInput = {
  mealDate: "2026-08-10",
  mealTime: "12:00",
  province: "경기도",
  city: "용인시",
  district: "기흥구 영덕동",
  restaurantInternalId: "rest_1",
  restaurantDisplayInput: "내부 음식점",
  foodCategory: "냉면",
  menu: "물냉면",
  serviceMode: "dine_in",
  symptoms: ["설사", "복통"],
  diarrheaCount: 3,
  otherSymptom: "",
  onsetDate: "2026-08-10",
  onsetTime: "18:30",
  partyTotal: 5,
  partySymptomatic: 4,
  companionSymptoms: ["복통"],
  companionOnsetAt: "2026-08-10T19:00",
  companionMedicalVisit: false,
  companionTested: false,
  medicalVisit: true,
  hospitalized: false,
  tested: false,
  pathogenKnown: false,
  pathogenType: "",
  sensitiveDataConsentVersion: "health-v1",
};

test("validates and calculates incubation in Korean local time", () => {
  const report = validateReportInput(validInput);
  assert.equal(report.incubationMinutes, 390);
  assert.equal(report.partySymptomatic, 4);
});

test("rejects companion counts that exceed the party", () => {
  assert.throws(() => validateReportInput({ ...validInput, partyTotal: 2, partySymptomatic: 2 }), InputError);
});

test("rejects diagnosis-like or unsupported symptom fields", () => {
  assert.throws(() => validateReportInput({ ...validInput, symptoms: ["식중독 확정"] }), InputError);
});

test("creates stable private dedupe keys without exposing inputs", () => {
  const secret = "a-secure-test-secret-that-is-longer-than-32-characters";
  const first = createDedupeKey(secret, "uid-1", "restaurant-1", "2026-08-10");
  const same = createDedupeKey(secret, "uid-1", "restaurant-1", "2026-08-10");
  const otherDay = createDedupeKey(secret, "uid-1", "restaurant-1", "2026-08-11");
  assert.equal(first, same);
  assert.notEqual(first, otherDay);
  assert.equal(first.includes("uid-1"), false);
});

test("uses deterministic hourly rate limit buckets", () => {
  assert.equal(rateLimitBucket(new Date("2026-08-10T01:01:00Z"), 60), rateLimitBucket(new Date("2026-08-10T01:59:00Z"), 60));
  assert.notEqual(rateLimitBucket(new Date("2026-08-10T01:59:00Z"), 60), rateLimitBucket(new Date("2026-08-10T02:00:00Z"), 60));
});
