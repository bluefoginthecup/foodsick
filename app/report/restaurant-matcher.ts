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
};

export async function findRestaurantCandidates(query: string, region: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query.trim(), region: region.trim() });
  const response = await fetch(`/api/restaurants/search?${params.toString()}`, { signal });
  const payload = await readJsonResponse<{ candidates?: RestaurantCandidate[]; error?: string }>(response, "음식점을 검색하지 못했습니다");
  if (!response.ok) throw new Error(payload.error || "음식점을 검색하지 못했습니다.");
  return payload.candidates ?? [];
}
