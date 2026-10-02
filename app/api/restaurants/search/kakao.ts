import { kakaoFoodCategory } from "../../../../functions/src/domain/food-category.ts";
export { kakaoFoodCategory };

export type KakaoRestaurant = {
  id: string;
  place_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  category_group_code: string;
  category_name: string;
  place_url: string;
};

type KakaoSearchResponse = { documents?: KakaoRestaurant[] };
type FetchLike = typeof fetch;

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

function isFoodPlace(place: KakaoRestaurant) {
  return ["FD6", "CE7"].includes(place.category_group_code)
    || /(음식점|카페|제과|베이커리|편의점|마트)/.test(place.category_name);
}

export async function fetchKakaoRestaurants(
  query: string,
  region: string,
  apiKey: string,
  fetcher: FetchLike = fetch,
) {
  const url = new URL(KAKAO_KEYWORD_URL);
  url.searchParams.set("query", [region, query].filter(Boolean).join(" "));
  url.searchParams.set("size", "15");
  const response = await fetcher(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) throw new Error(`Kakao Local API returned ${response.status}`);
  const payload = await response.json() as KakaoSearchResponse;
  const regionTokens = region.split(/\s+/).filter((token) => token.length >= 2);
  const specificRegionTokens = regionTokens.length >= 3 ? regionTokens.slice(-2) : regionTokens.slice(-1);
  return (payload.documents ?? [])
    .filter((place) => place.id && place.place_name && isFoodPlace(place))
    .filter((place) => {
      if (!specificRegionTokens.length) return true;
      const address = `${place.road_address_name} ${place.address_name}`;
      return specificRegionTokens.every((token) => address.includes(token));
    })
    .map((place) => ({
      internalId: `kakao_${place.id}`,
      sourcePlaceId: place.id,
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      category: kakaoFoodCategory(place.category_name, place.place_name),
      categoryLabel: place.category_name.split(" > ").slice(-2).join(" · "),
      phone: place.phone,
      placeUrl: place.place_url,
    }));
}
