import assert from "node:assert/strict";
import test from "node:test";
import { fetchKakaoRegionalContacts } from "../app/api/regional-contacts/kakao.ts";
import {
  fetchOfficialFoodSafetyContact,
  parseFoodSafetyStaff,
  parseOrganizations,
} from "../app/api/regional-contacts/official-organizations.ts";
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

test("parses a food hygiene department from the official organization directory", () => {
  const organizations = parseOrganizations(`
    <table><tr><td class="align-center">3790009<br></td>
    <td>경기도 성남시 수정구 환경위생과</td><td>환경위생과</td>
    <td>031 729 5281&nbsp;</td><td>현존</td><td>&nbsp;</td></tr></table>
  `);
  assert.deepEqual(organizations, [{
    code: "3790009",
    fullName: "경기도 성남시 수정구 환경위생과",
    name: "환경위생과",
    phone: "031-729-5281",
  }]);
});

test("selects the current staff member responsible for food poisoning", () => {
  const staff = parseFoodSafetyStaff(`
    <table><tr><td>위생지도팀장</td><td>031-6193-6305</td><td>위생지도팀 업무 총괄</td></tr>
    <tr><td>주무관</td><td>031-6193-6302</td><td>행정처분, 식중독 예방 및 관리 업무, 위생업소 지도점검</td></tr></table>
  `);
  assert.equal(staff.phone, "031-6193-6302");
  assert.match(staff.duty, /식중독 예방 및 관리/);
});

test("uses Yongin's live staff directory when the national directory has no department phone", async () => {
  const requests = [];
  const fakeFetch = async (input, init = {}) => {
    const url = input.toString();
    requests.push({ url, method: init.method ?? "GET" });
    if (url.endsWith("orgCodeL.do")) return new Response("ok", { headers: { "set-cookie": "JSESSIONID=test; Path=/" } });
    if (url.endsWith("orgCodeFrameL.do")) return new Response(`
      <table><tr><td>5630018</td><td>경기도 용인시 기흥구 산업환경과</td><td>산업환경과</td><td>&nbsp;</td><td>현존</td><td></td></tr></table>
    `);
    return new Response(`
      <table><tr><td>주무관</td><td>031-6193-6302</td><td>식중독 예방 및 관리 업무</td></tr></table>
    `);
  };

  const contact = await fetchOfficialFoodSafetyContact(selection, fakeFetch);
  assert.equal(contact.kind, "food_safety");
  assert.equal(contact.name, "기흥구 산업환경과");
  assert.equal(contact.phone, "031-6193-6302");
  assert.equal(contact.sourceLabel, "지자체 공식 직원안내");
  assert.ok(requests.some(({ url }) => url.includes("q_deptCode=5630018000000000000")));
});

test("keeps the official department visible when its direct phone is temporarily unavailable", async () => {
  const fakeFetch = async (input) => {
    const url = input.toString();
    if (url.endsWith("orgCodeL.do")) return new Response("ok");
    if (url.endsWith("orgCodeFrameL.do")) return new Response(`
      <table><tr><td>5630018</td><td>경기도 용인시 기흥구 산업환경과</td><td>산업환경과</td><td>&nbsp;</td><td>현존</td><td></td></tr></table>
    `);
    return new Response("temporary error", { status: 500 });
  };
  const contact = await fetchOfficialFoodSafetyContact(selection, fakeFetch);
  assert.equal(contact.name, "기흥구 산업환경과");
  assert.equal(contact.phone, "");
  assert.match(contact.address, /구청 대표전화/);
});
