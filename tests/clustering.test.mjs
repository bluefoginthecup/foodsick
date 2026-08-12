import assert from "node:assert/strict";
import test from "node:test";
import { buildClusterCandidates, createPrivacySafeAggregate } from "../app/clustering/engine.ts";

const baseReport = {
  canonicalRestaurantId: "private_restaurant_1",
  foodCategory: "냉면",
  symptomOnsetAt: "2026-08-11T12:00:00.000Z",
  symptoms: ["설사", "복통"],
  partySymptomatic: 0,
  medicalVisit: false,
  status: "submitted",
};

test("requires three unique owners and does not count companions as reports", () => {
  const reports = [
    { ...baseReport, id: "r1", ownerUid: "u1", mealAt: "2026-08-10T01:00:00.000Z", partySymptomatic: 4 },
    { ...baseReport, id: "r2", ownerUid: "u2", mealAt: "2026-08-10T02:00:00.000Z" },
    { ...baseReport, id: "r3", ownerUid: "u3", mealAt: "2026-08-10T03:00:00.000Z", medicalVisit: true },
  ];
  const [cluster] = buildClusterCandidates(reports);
  assert.equal(cluster.independentReporterCount, 3);
  assert.equal(cluster.companionSymptomaticCount, 4);
  assert.equal(cluster.totalSymptomaticCount, 7);
  assert.equal(cluster.status, "increased_signal");
  assert.notEqual(cluster.status, "official_confirmed");
});

test("does not make a cluster from duplicate owners", () => {
  const reports = [
    { ...baseReport, id: "r1", ownerUid: "u1", mealAt: "2026-08-10T01:00:00.000Z" },
    { ...baseReport, id: "r2", ownerUid: "u1", mealAt: "2026-08-10T02:00:00.000Z" },
    { ...baseReport, id: "r3", ownerUid: "u2", mealAt: "2026-08-10T03:00:00.000Z" },
  ];
  assert.equal(buildClusterCandidates(reports).length, 0);
});

test("widens the public region when a category is rare", () => {
  const [cluster] = buildClusterCandidates([
    { ...baseReport, id: "r1", ownerUid: "u1", mealAt: "2026-08-10T01:00:00.000Z" },
    { ...baseReport, id: "r2", ownerUid: "u2", mealAt: "2026-08-10T02:00:00.000Z" },
    { ...baseReport, id: "r3", ownerUid: "u3", mealAt: "2026-08-10T03:00:00.000Z" },
  ]);
  const aggregate = createPrivacySafeAggregate(cluster, [
    { level: "dong", code: "dong", label: "영덕동", sameCategoryVenueCount: 1, publicCenter: { lat: 37.27, lng: 127.07 } },
    { level: "gu", code: "gu", label: "기흥구", sameCategoryVenueCount: 5, publicCenter: { lat: 37.28, lng: 127.11 } },
    { level: "city", code: "city", label: "용인시", sameCategoryVenueCount: 20, publicCenter: { lat: 37.24, lng: 127.18 } },
  ]);
  assert.equal(aggregate.displayRegionLevel, "gu");
  assert.equal(aggregate.displayRegion, "기흥구");
  assert.equal("canonicalRestaurantId" in aggregate, false);
  assert.equal(aggregate.companionSymptomaticCount, null);
});
