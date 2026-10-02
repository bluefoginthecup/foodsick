import assert from "node:assert/strict";
import test from "node:test";
import { buildClusterCandidates } from "../lib/domain/clustering.js";
import { chooseSafeRegion, toPublicSignal, publicSignalView } from "../lib/domain/public-signal.js";
import { verifyVenuePrivacy } from "../lib/domain/venue-privacy.js";

const report = (id, day = 10, extra = {}) => ({ id, ownerUid: id, canonicalRestaurantId: "kakao_100", foodCategory: "냉면",
  mealAt: `2026-08-${day}T01:00:00Z`, symptomOnsetAt: `2026-08-${day}T10:00:00Z`, symptoms: ["설사"], partySymptomatic: 0,
  medicalVisit: false, status: "submitted", ...extra });
const base = [report("a"), report("b"), report("c")];

test("create, edit, exclusion, deletion and restaurant changes recalculate from current reports", () => {
  assert.equal(buildClusterCandidates(base.slice(0, 2)).length, 0);
  assert.equal(buildClusterCandidates(base).length, 1);
  for (const extra of [{ status: "rejected" }, { status: "duplicate_suspected" }, { symptoms: ["두통"] }, { canonicalRestaurantId: "kakao_200" }, { foodCategory: "한식" }, { mealAt: "2026-08-20T01:00:00Z", symptomOnsetAt: "2026-08-21T01:00:00Z" }]) {
    assert.equal(buildClusterCandidates([base[0], base[1], { ...base[2], ...extra }]).length, 0);
  }
  assert.equal(buildClusterCandidates(base.slice(1)).length, 0);
  assert.equal(buildClusterCandidates([...base].reverse())[0].candidateId, buildClusterCandidates(base)[0].candidateId);
});

test("keeps separate episodes, no overlapping reports and exactly 72h is included", () => {
  const episodes = buildClusterCandidates([...base, report("d", 20), report("e", 20), report("f", 20)]);
  assert.equal(episodes.length, 2);
  assert.equal(new Set(episodes.flatMap((c) => c.reportIds)).size, 6);
  assert.equal(buildClusterCandidates([base[0], base[1], report("c", 13)]).length, 1);
  assert.equal(buildClusterCandidates([base[0], base[1], report("c", 13, { mealAt: "2026-08-13T01:00:01Z" })]).length, 0);
});

test("deduplicates accounts, keeps companions separate and hides small health counts", () => {
  const [cluster] = buildClusterCandidates([...base, report("again", 10, { ownerUid: "a", partySymptomatic: 50 })]);
  assert.equal(cluster.independentReporterCount, 3);
  assert.equal(cluster.companionSymptomaticCount, 0);
  const region = { sido: "경기도", city: "용인시", district: "기흥구", dong: "", code: "41463", level: "gu", sameCategoryVenueCount: 3 };
  const view = toPublicSignal("opaque-id", cluster, region);
  assert.equal(view.companionSymptoms, 0);
  assert.equal(view.medicalVisits, 0);
  const publicView = publicSignalView({ ...view, restaurantId: "private", ownerUid: "private", reportIds: ["private"], displayCenter: { lat: 37, lng: 127 }, draft: { name: "private" } });
  assert.deepEqual(publicView, view);
  assert.equal(publicSignalView({ ...view, independentReports: 2 }), null);
  assert.equal(chooseSafeRegion([{ ...region, sameCategoryVenueCount: 2 }]), null);
});

const geo = (dong = "영덕1동") => ({ region_type: "H", code: dong === "영덕1동" ? "4146357000" : "4146358000", region_1depth_name: "경기도", region_2depth_name: "용인시 기흥구", region_3depth_name: dong });
const place = (id) => ({ id, x: id, y: "37", place_name: "냉면", category_name: "음식점 > 한식 > 냉면", category_group_code: "FD6" });

test("provider verification widens sparse dong to district using unique real places", async () => {
  const fake = async (path, params) => {
    if (path === "geo/coord2regioncode") return [geo(params.x === "100" ? "영덕1동" : "영덕2동")];
    if (params.query.includes("비공개상호")) return [place("100")];
    return [place("100"), place("100"), place("200"), place("300")];
  };
  const region = await verifyVenuePrivacy("kakao_100", "비공개상호", "경기도 용인시", "냉면", fake);
  assert.equal(region.level, "gu");
  assert.equal(region.dong, "");
  assert.equal(region.sameCategoryVenueCount, 3);
});

test("unverified places, duplicate search hits and wrong categories do not pass privacy gate", async () => {
  assert.equal(await verifyVenuePrivacy("manual_1", "private", "region", "냉면", () => { throw new Error("must not call"); }), null);
  const duplicate = async (path) => path === "geo/coord2regioncode" ? [geo()] : [place("100"), place("100"), { ...place("200"), category_name: "중식", place_name: "중식" }];
  assert.equal(await verifyVenuePrivacy("kakao_100", "private", "region", "냉면", duplicate), null);
  assert.equal(await verifyVenuePrivacy("kakao_999", "private", "region", "냉면", duplicate), null);
  await assert.rejects(() => verifyVenuePrivacy("kakao_100", "private", "region", "냉면", async () => { throw new Error("provider unavailable"); }));
});
