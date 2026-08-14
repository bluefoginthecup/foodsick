import assert from "node:assert/strict";
import test from "node:test";
import { fetchKakaoRestaurants, kakaoFoodCategory } from "../app/api/restaurants/search/kakao.ts";

test("maps Kakao place categories to the expanded report categories", () => {
  assert.equal(kakaoFoodCategory("음식점 > 한식 > 육류,고기", "영덕갈비"), "고기/구이");
  assert.equal(kakaoFoodCategory("음식점 > 카페 > 제과,베이커리", "동네빵집"), "카페/디저트");
  assert.equal(kakaoFoodCategory("음식점 > 아시아음식 > 베트남음식", "포하노이"), "동남아/아시아");
});

test("searches live Kakao places and keeps food results in the selected region", async () => {
  let requestedUrl = "";
  let authorization = "";
  const fakeFetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = init.headers.Authorization;
    return Response.json({ documents: [
      { id: "100", place_name: "영덕갈비", phone: "031-000-0000", address_name: "경기 용인시 기흥구 영덕동", road_address_name: "경기 용인시 기흥구 흥덕로 1", category_group_code: "FD6", category_name: "음식점 > 한식 > 육류,고기", place_url: "https://place.map.kakao.com/100" },
      { id: "200", place_name: "서울갈비", phone: "02-000-0000", address_name: "서울 강남구", road_address_name: "", category_group_code: "FD6", category_name: "음식점 > 한식", place_url: "https://place.map.kakao.com/200" },
      { id: "250", place_name: "수지갈비", phone: "031-111-1111", address_name: "경기 용인시 수지구", road_address_name: "", category_group_code: "FD6", category_name: "음식점 > 한식", place_url: "https://place.map.kakao.com/250" },
      { id: "300", place_name: "영덕문구", phone: "", address_name: "경기 용인시 기흥구 영덕동", road_address_name: "", category_group_code: "", category_name: "가정,생활 > 문구", place_url: "https://place.map.kakao.com/300" },
    ] });
  };
  const results = await fetchKakaoRestaurants("영덕갈비", "경기도 용인시 기흥구", "secret", fakeFetch);
  assert.equal(results.length, 1);
  assert.equal(results[0].internalId, "kakao_100");
  assert.equal(results[0].category, "고기/구이");
  assert.equal(authorization, "KakaoAK secret");
  assert.equal(new URL(requestedUrl).searchParams.get("query"), "경기도 용인시 기흥구 영덕갈비");
});
