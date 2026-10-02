import { readJsonResponse } from "../http-response";

export type RestaurantCandidate = {
  internalId: string;
  sourcePlaceId: string;
  name: string;
  address: string;
  category: string;
  categoryLabel: string;
  phone: string;
  placeUrl: string;
  x: string;
  y: string;
};

export async function findRestaurantCandidates(query: string, region: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query.trim(), region: region.trim() });
  const response = await fetch(`/api/restaurants/search?${params.toString()}`, { signal });
  const payload = await readJsonResponse<{ candidates?: RestaurantCandidate[]; error?: string }>(response, "음식점을 검색하지 못했습니다");
  if (!response.ok) throw new Error(payload.error || "음식점을 검색하지 못했습니다.");
  return payload.candidates ?? [];
}

export async function findRestaurantRegion(place: RestaurantCandidate, signal?: AbortSignal) {
  const response = await fetch(`/api/restaurants/region?${new URLSearchParams({ x: place.x, y: place.y })}`, { signal });
  const payload = await readJsonResponse<{ region: { province: string; city: string; district: string }; error?: string }>(response, "음식점 지역을 확인하지 못했습니다");
  if (!response.ok) throw new Error(payload.error || "지역 자동 입력에 실패했습니다. 아래 목록에서 선택해주세요.");
  return payload.region;
}
