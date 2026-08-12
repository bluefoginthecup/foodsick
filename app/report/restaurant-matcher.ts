export type RestaurantCandidate = {
  internalId: string;
  sourcePlaceId: string;
  name: string;
  address: string;
  category: string;
};

export const restaurantCandidates: RestaurantCandidate[] = [
  {
    internalId: "rest_mock_yd_001",
    sourcePlaceId: "kakao_mock_10001",
    name: "교동면옥 용인영덕점",
    address: "경기 용인시 기흥구 영덕동",
    category: "냉면",
  },
  {
    internalId: "rest_mock_yd_002",
    sourcePlaceId: "kakao_mock_10002",
    name: "영덕옥 냉면",
    address: "경기 용인시 기흥구 영덕동",
    category: "냉면",
  },
  {
    internalId: "rest_mock_suwon_001",
    sourcePlaceId: "kakao_mock_20001",
    name: "영통 한상",
    address: "경기 수원시 영통구 영통동",
    category: "한식",
  },
];

export function normalizeRestaurantName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]/g, "")
    .replace(/(본점|지점)$/g, "");
}

export function findRestaurantCandidates(query: string) {
  const normalized = normalizeRestaurantName(query);
  if (normalized.length < 2) return [];
  return restaurantCandidates.filter((candidate) => {
    const name = normalizeRestaurantName(candidate.name);
    return name.includes(normalized) || normalized.includes(name.slice(0, Math.max(2, normalized.length)));
  });
}
