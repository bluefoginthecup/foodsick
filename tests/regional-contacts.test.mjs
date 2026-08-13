import assert from "node:assert/strict";
import test from "node:test";
import { fetchKakaoRegionalContacts } from "../app/api/regional-contacts/kakao.ts";
import { phoneHref } from "../app/regional-contacts.ts";

const selection = { sido: "경기도", city: "용인시", district: "기흥구", dong: "영덕1동" };

test("normalizes API phone and address data without a static regional directory", async () => {
  const requests = [];
  const fakeFetch = async (input, init) => {
    const url = new URL(input);
    const query = url.searchParams.get("query");
    requests.push({ query, authorization: init.headers.Authorization });
    const isHealthCenter = query.includes("보건소");
    return Response.json({
      documents: [{
        place_name: isHealthCenter ? "기흥구보건소" : "검색 결과",
        phone: isHealthCenter ? "031-123-4567" : "",
        address_name: "경기 용인시 기흥구 신갈동",
        road_address_name: "경기 용인시 기흥구 신갈로 58번길 11",
        category_group_code: "PO3",
        place_url: "https://place.map.kakao.com/123",
      }],
    });
  };

  const contacts = await fetchKakaoRegionalContacts(selection, "secret-test-key", fakeFetch);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].kind, "health_center");
  assert.equal(contacts[0].phone, "031-123-4567");
  assert.equal(contacts[0].address, "경기 용인시 기흥구 신갈로 58번길 11");
  assert.ok(requests.every((request) => request.authorization === "KakaoAK secret-test-key"));
  assert.ok(requests.some((request) => request.query.includes("기흥구 보건소")));
  assert.ok(requests.some((request) => request.query.includes("용인시청")));
});

test("rejects unrelated or non-government hygiene places and keeps phone links dialable", async () => {
  const fakeFetch = async () => Response.json({
    documents: [{
      place_name: "기흥위생관리",
      phone: "031-000-0000",
      address_name: "경기 용인시 기흥구 신갈동",
      road_address_name: "경기 용인시 기흥구 신갈로",
      category_group_code: "PO3",
      place_url: "https://place.map.kakao.com/999",
    }],
  });
  assert.deepEqual(await fetchKakaoRegionalContacts(selection, "key", fakeFetch), []);
  assert.equal(phoneHref("031-123-4567"), "tel:0311234567");
});
