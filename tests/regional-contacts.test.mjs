import assert from "node:assert/strict";
import test from "node:test";
import { contactsForRegion, phoneHref } from "../app/regional-contacts.ts";

test("returns verified food-safety contacts for Yongin Giheung-gu", () => {
  const directory = contactsForRegion("경기도 용인시 기흥구 영덕1동");
  assert.ok(directory);
  const hygiene = directory.contacts.find((contact) => contact.kind === "food_safety");
  assert.equal(hygiene?.name, "기흥구청 산업환경과 위생지도");
  assert.equal(hygiene?.phone, "031-6193-6303");
});

test("does not guess contacts for an unverified region", () => {
  assert.equal(contactsForRegion("서울특별시 종로구 청운효자동"), null);
  assert.equal(phoneHref("031-6193-6303"), "tel:03161936303");
});
