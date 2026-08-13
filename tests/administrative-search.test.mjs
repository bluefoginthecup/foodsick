import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdministrativeSearchIndex,
  regionMatches,
  searchAdministrativeRegions,
  selectedRegionLabel,
} from "../app/administrative-search.ts";

const boundaries = {
  sido: [{ properties: { sidonm: "울산광역시" } }, { properties: { sidonm: "경기도" } }],
  sgg: [
    { properties: { sidonm: "울산광역시", sggnm: "중구" } },
    { properties: { sidonm: "경기도", sggnm: "용인시기흥구" } },
  ],
  emd: [
    { properties: { sidonm: "울산광역시", sggnm: "중구", emdnm: "학성동" } },
    { properties: { sidonm: "경기도", sggnm: "용인시기흥구", emdnm: "영덕1동" } },
  ],
};

test("finds a metropolitan district from a natural two-word query", () => {
  const index = buildAdministrativeSearchIndex(boundaries);
  const [result] = searchAdministrativeRegions(index, "울산 중구");
  assert.equal(result.label, "울산광역시 중구");
  assert.deepEqual(result.selection, { sido: "울산광역시", city: "중구", district: "중구", dong: "" });
  assert.equal(result.targetLevel, "dong");
});

test("deduplicates one-tier district labels and matches selected region signals", () => {
  const selection = { sido: "울산광역시", city: "중구", district: "중구", dong: "" };
  assert.equal(selectedRegionLabel(selection), "울산광역시 중구");
  assert.equal(regionMatches({ ...selection, dong: "학성동" }, selection), true);
  assert.equal(regionMatches({ sido: "울산광역시", city: "남구", district: "남구", dong: "삼산동" }, selection), false);
});
